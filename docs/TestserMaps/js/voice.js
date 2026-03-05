// ============================================================
// TestserMaps - Voice Manager
// Handles text-to-speech narration using the Web Speech API.
// Converts navigation instructions into spoken announcements
// with distance-based prompts and repetition prevention.
// ============================================================

import { formatDistance, storage } from './utils.js';

export class VoiceManager {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.selectedVoice = null;
    this.enabled = true;
    this.muted = false;

    // Track announcements to prevent repetition
    this.lastAnnouncement = '';
    this.lastAnnouncementTime = 0;
    this.minRepeatInterval = 8000; // 8 seconds between same announcement

    // Load preferences
    this.enabled = storage.get('voice_enabled', true);
    this.muted = storage.get('voice_muted', false);
    const savedVoiceName = storage.get('voice_name', null);

    // Initialize voices
    if (this.synth) {
      // Voices may not be available immediately
      this.loadVoices();
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
        // Try to restore saved voice
        if (savedVoiceName) {
          const found = this.voices.find((v) => v.name === savedVoiceName);
          if (found) this.selectedVoice = found;
        }
      };
    }
  }

  /**
   * Load available speech synthesis voices.
   */
  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices().filter((v) => v.lang.startsWith('en'));

    // Default to a natural-sounding voice if available
    if (!this.selectedVoice && this.voices.length > 0) {
      this.selectedVoice =
        this.voices.find(
          (v) =>
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel')
        ) || this.voices[0];
    }
  }

  /**
   * Get all available English voices.
   * @returns {Array<SpeechSynthesisVoice>}
   */
  getVoices() {
    return this.voices;
  }

  /**
   * Set the voice to use for announcements.
   * @param {string} voiceName - Name of the voice
   */
  setVoice(voiceName) {
    const voice = this.voices.find((v) => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice;
      storage.set('voice_name', voiceName);
    }
  }

  /**
   * Enable or disable voice narration.
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    storage.set('voice_enabled', enabled);
    if (!enabled) this.stop();
  }

  /**
   * Mute or unmute (keeps enabled state but silences output).
   */
  setMuted(muted) {
    this.muted = muted;
    storage.set('voice_muted', muted);
    if (muted) this.stop();
  }

  /**
   * Toggle mute state.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Speak a text string.
   * @param {string} text - Text to speak
   * @param {object} options - Speech options
   * @param {boolean} options.force - Force speak even if same as last
   * @param {number} options.rate - Speech rate (0.5-2.0)
   */
  speak(text, options = {}) {
    if (!this.synth || !this.enabled || this.muted) return;
    if (!text) return;

    const now = Date.now();

    // Prevent repetition (unless forced)
    if (!options.force) {
      if (
        text === this.lastAnnouncement &&
        now - this.lastAnnouncementTime < this.minRepeatInterval
      ) {
        return;
      }
    }

    // Cancel any current speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.rate = options.rate || 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    this.synth.speak(utterance);
    this.lastAnnouncement = text;
    this.lastAnnouncementTime = now;
  }

  /**
   * Stop any current speech.
   */
  stop() {
    if (this.synth) this.synth.cancel();
  }

  /**
   * Generate and speak a navigation announcement based on distance to next turn.
   * @param {object} step - Current navigation step
   * @param {number} distanceToManeuver - Distance to maneuver in meters
   * @param {object} announcementState - Tracks which announcements have been made
   * @returns {string|null} The announcement text, or null if nothing spoken
   */
  announceNavigation(step, distanceToManeuver, announcementState) {
    if (!step || !this.enabled || this.muted) return null;

    const key = `step_${step.instruction}`;
    if (!announcementState[key]) {
      announcementState[key] = { far: false, near: false, immediate: false };
    }
    const state = announcementState[key];

    let text = null;

    // Arrival announcement
    if (step.maneuver.type === 'arrive' && distanceToManeuver < 50) {
      if (!state.immediate) {
        text = 'You have arrived at your destination.';
        state.immediate = true;
      }
      // Skip further checks for arrival
      if (text) {
        this.speak(text);
        return text;
      }
      return null;
    }

    // Far announcement: ~300m before turn
    if (distanceToManeuver <= 350 && distanceToManeuver > 150 && !state.far) {
      text = this.buildApproachPhrase(step, distanceToManeuver);
      state.far = true;
    }
    // Near announcement: ~100m before turn
    else if (distanceToManeuver <= 150 && distanceToManeuver > 40 && !state.near) {
      text = this.buildNearPhrase(step);
      state.near = true;
    }
    // Immediate announcement: at the turn
    else if (distanceToManeuver <= 40 && !state.immediate) {
      text = this.buildImmediatePhrase(step);
      state.immediate = true;
    }

    if (text) {
      this.speak(text);
      return text;
    }
    return null;
  }

  /**
   * Announce rerouting.
   */
  announceRerouting() {
    this.speak('Recalculating route.', { force: true });
  }

  /**
   * Build approach phrase (~300m out).
   */
  buildApproachPhrase(step, distance) {
    const dist = formatDistance(Math.round(distance / 50) * 50); // Round to nearest 50m
    const action = this.simplifyInstruction(step.instruction);
    return `In ${dist}, ${action}.`;
  }

  /**
   * Build near phrase (~100m out).
   */
  buildNearPhrase(step) {
    const action = this.simplifyInstruction(step.instruction);
    return `${action} ahead.`;
  }

  /**
   * Build immediate phrase (at the turn).
   */
  buildImmediatePhrase(step) {
    const action = this.simplifyInstruction(step.instruction);
    return `${action} now.`;
  }

  /**
   * Simplify instruction text for more natural speech.
   */
  simplifyInstruction(instruction) {
    // Make the first letter lowercase for mid-sentence use
    let text = instruction;
    if (text.length > 0) {
      text = text.charAt(0).toLowerCase() + text.slice(1);
    }
    return text;
  }

  /**
   * Check if the Web Speech API is supported.
   */
  isSupported() {
    return !!this.synth;
  }
}
