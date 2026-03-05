// ============================================================
// TestserMaps - Navigation Manager
// Handles real-time turn-by-turn navigation:
// - GPS tracking via watchPosition
// - Position matching to route polyline
// - Step advancement and off-route detection
// - Route recalculation triggers
// ============================================================

import { haversineDistance, nearestPointOnPolyline, showToast } from './utils.js';

// Navigation thresholds (meters)
const OFF_ROUTE_THRESHOLD = 50; // Distance from route to trigger reroute
const STEP_ADVANCE_THRESHOLD = 30; // Distance to maneuver point to advance step
const REROUTE_COOLDOWN = 8000; // Min ms between reroute attempts
const STARTUP_GRACE_MS = 6000; // Ignore off-route for first N ms after start

export class NavigationManager {
  constructor() {
    // State
    this.active = false;
    this.route = null;
    this.steps = [];
    this.currentStepIndex = 0;
    this.userPosition = null;
    this.userHeading = null;
    this.userSpeed = null; // m/s
    this.watchId = null;

    // Off-route detection
    this.lastRerouteTime = 0;
    this.isRerouting = false;
    this.startTime = 0; // timestamp when navigation started

    // Voice announcement state (tracks which announcements have been made per step)
    this.announcementState = {};

    // Callbacks
    this.onPositionUpdate = null; // (position) => {}
    this.onStepChange = null; // (stepIndex, step) => {}
    this.onOffRoute = null; // () => {}
    this.onArrival = null; // () => {}
    this.onError = null; // (error) => {}
  }

  /**
   * Start navigation mode with a calculated route.
   * @param {object} route - Route object from RoutingManager
   */
  start(route) {
    if (!route || !route.steps || route.steps.length === 0) {
      console.error('Cannot start navigation: no route');
      return false;
    }

    this.active = true;
    this.route = route;
    this.steps = route.steps;
    this.currentStepIndex = 0;
    this.announcementState = {};
    this.isRerouting = false;
    this.startTime = Date.now();

    // Start GPS tracking
    this.startTracking();

    return true;
  }

  /**
   * Stop navigation mode and GPS tracking.
   */
  stop() {
    this.active = false;
    this.stopTracking();
    this.route = null;
    this.steps = [];
    this.currentStepIndex = 0;
    this.announcementState = {};
  }

  /**
   * Update the route (used after rerouting).
   * @param {object} newRoute - New route object
   */
  updateRoute(newRoute) {
    this.route = newRoute;
    this.steps = newRoute.steps;
    this.currentStepIndex = 0;
    this.announcementState = {};
    this.isRerouting = false;
  }

  /**
   * Start watching the user's GPS position.
   */
  startTracking() {
    if (!navigator.geolocation) {
      if (this.onError) this.onError(new Error('Geolocation not supported'));
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 2000, // Accept positions up to 2s old
        timeout: 10000
      }
    );
  }

  /**
   * Stop watching the user's GPS position.
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Handle a new GPS position update.
   * Core navigation logic runs here.
   */
  handlePositionUpdate(position) {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;

    this.userPosition = [latitude, longitude];
    this.userHeading = heading;
    this.userSpeed = speed;

    // Notify listeners of position update
    if (this.onPositionUpdate) {
      this.onPositionUpdate({
        latlng: [latitude, longitude],
        accuracy,
        heading,
        speed
      });
    }

    // If navigation is active, process position against route
    if (this.active && this.route) {
      this.processPosition(latitude, longitude);
    }
  }

  /**
   * Handle GPS error.
   */
  handlePositionError(error) {
    console.warn('GPS error:', error.message);
    if (this.onError) this.onError(error);

    // Common errors:
    // 1 = PERMISSION_DENIED
    // 2 = POSITION_UNAVAILABLE
    // 3 = TIMEOUT
    if (error.code === 1) {
      showToast('Location permission denied. Enable location access.');
    } else if (error.code === 2) {
      showToast('Unable to determine your location.');
    }
  }

  /**
   * Process the current position against the route.
   * Determines: nearest point on route, distance to next maneuver,
   * whether user has gone off-route, and whether to advance steps.
   */
  processPosition(lat, lng) {
    if (!this.route || !this.route.coordinates || this.route.coordinates.length < 2) return;

    // Find nearest point on the route polyline
    const nearest = nearestPointOnPolyline(this.route.coordinates, [lat, lng]);

    // Skip off-route detection during the startup grace period so
    // an inaccurate initial GPS fix doesn't immediately trigger rerouting
    const elapsed = Date.now() - this.startTime;
    if (nearest.distance > OFF_ROUTE_THRESHOLD && !this.isRerouting && elapsed > STARTUP_GRACE_MS) {
      this.handleOffRoute();
      return;
    }

    // Determine which step we're currently on
    this.updateCurrentStep(lat, lng);
  }

  /**
   * Update the current navigation step based on user position.
   * Advances step when user reaches the maneuver point.
   */
  updateCurrentStep(lat, lng) {
    if (this.currentStepIndex >= this.steps.length) return;

    const currentStep = this.steps[this.currentStepIndex];
    const maneuverPoint = currentStep.maneuver.location;

    // Distance from user to the current step's maneuver point
    const distToManeuver = haversineDistance(
      lat, lng,
      maneuverPoint[0], maneuverPoint[1]
    );

    // Check if user has reached this maneuver point (advance to next step)
    if (distToManeuver < STEP_ADVANCE_THRESHOLD && this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      if (this.onStepChange) {
        this.onStepChange(this.currentStepIndex, this.steps[this.currentStepIndex]);
      }
    }

    // Check for arrival at destination (last step)
    if (this.currentStepIndex === this.steps.length - 1) {
      const lastStep = this.steps[this.steps.length - 1];
      const distToEnd = haversineDistance(
        lat, lng,
        lastStep.maneuver.location[0], lastStep.maneuver.location[1]
      );
      if (distToEnd < STEP_ADVANCE_THRESHOLD) {
        if (this.onArrival) this.onArrival();
      }
    }
  }

  /**
   * Handle off-route detection. Triggers reroute with cooldown.
   */
  handleOffRoute() {
    const now = Date.now();
    if (now - this.lastRerouteTime < REROUTE_COOLDOWN) return;

    this.isRerouting = true;
    this.lastRerouteTime = now;

    if (this.onOffRoute) this.onOffRoute();
  }

  /**
   * Get the current step object.
   * @returns {object|null}
   */
  getCurrentStep() {
    if (!this.steps || this.currentStepIndex >= this.steps.length) return null;
    return this.steps[this.currentStepIndex];
  }

  /**
   * Get the next step object (one after current).
   * @returns {object|null}
   */
  getNextStep() {
    const nextIdx = this.currentStepIndex + 1;
    if (!this.steps || nextIdx >= this.steps.length) return null;
    return this.steps[nextIdx];
  }

  /**
   * Calculate distance from user's current position to the next maneuver.
   * @returns {number} Distance in meters, or -1 if unknown
   */
  getDistanceToNextManeuver() {
    if (!this.userPosition || !this.steps) return -1;

    // The "next maneuver" is the one we're approaching
    // If currentStepIndex is 0, we're heading toward step 1's maneuver
    // If currentStepIndex is N, we're heading toward step N+1's maneuver
    const targetStep = this.getNextStep() || this.getCurrentStep();
    if (!targetStep) return -1;

    const maneuverPoint = targetStep.maneuver.location;
    return haversineDistance(
      this.userPosition[0], this.userPosition[1],
      maneuverPoint[0], maneuverPoint[1]
    );
  }

  /**
   * Calculate remaining distance and duration from current position.
   * @returns {{ distance: number, duration: number }}
   */
  getRemainingStats() {
    if (!this.steps) return { distance: 0, duration: 0 };

    let distance = 0;
    let duration = 0;

    for (let i = this.currentStepIndex; i < this.steps.length; i++) {
      distance += this.steps[i].distance;
      duration += this.steps[i].duration;
    }

    return { distance, duration };
  }

  /**
   * Get the announcement state object (used by VoiceManager).
   * @returns {object}
   */
  getAnnouncementState() {
    return this.announcementState;
  }

  /**
   * Check if the user is currently on the route.
   * @returns {boolean}
   */
  isOnRoute() {
    if (!this.userPosition || !this.route) return true;
    const nearest = nearestPointOnPolyline(this.route.coordinates, this.userPosition);
    return nearest.distance <= OFF_ROUTE_THRESHOLD;
  }
}
