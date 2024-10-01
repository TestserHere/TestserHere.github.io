const morseCodeDictionary = {
    '!':"-.-.--",
    '"':".-..-.",
    '$':"...-..-",
    '&':".-...",
    "'":".----.",
    '(':"-.--.",
    ')':"-.--.-",
    '+':".-.-.",
    ',':"--..--",
    '-':"-....-",
    '.':".-.-.-",
    '/':"-..-.",
    '0':"-----",
    '1':".----",
    '2':"..---",
    '3':"...--",
    '4':"....-",
    '5':".....",
    '6':"-....",
    '7':"--...",
    '8':"---..",
    '9':"----.",
    ':':"---...",
    ';':"-.-.-.",
    '=':"-...-",
    '?':"..--..",
    '@':".--.-.",
    '_':"..--.-",
    'A':".-",
    'B':"-...",
    'C':"-.-.",
    'D':"-..",
    'E':".",
    'F':"..-.",
    'G':"--.",
    'H':"....",
    'I':"..",
    'J':".---",
    'K':"-.-",
    'L':".-..",
    'M':"--",
    'N':"-.",
    'O':"---",
    'P':".--.",
    'Q':"--.-",
    'R':".-.",
    'S':"...",
    'T':"-",
    'U':"..-",
    'V':"...-",
    'W':".--",
    'X':"-..-",
    'Y':"-.--",
    'Z':"--.."
};

const textDictionary = Object.fromEntries(
    Object.entries(morseCodeDictionary).map(([letter, morse]) => [morse, letter])
);

const dotSound = new Audio('dot.wav');
const dashSound = new Audio('dash.wav');

document.getElementById('translateToMorseButton').addEventListener('click', async () => {
    const inputText = document.getElementById('textInput').value.toUpperCase();
    let morseOutput = '';

    for (let char of inputText) {
        if (morseCodeDictionary[char]) {
            const morseChar = morseCodeDictionary[char];
            morseOutput += morseChar + ' ';

            for (let symbol of morseChar) {
                if (symbol === '.') {
                    await dotSound.play();
                } else if (symbol === '-') {
                    await dashSound.play();
                }
                await sleep(300);
            }
            await sleep(700);
        } else {
            morseOutput += '? ';
        }
    }

    document.getElementById('morseOutput').textContent = morseOutput.trim();
});

document.getElementById('translateToTextButton').addEventListener('click', () => {
    const morseInput = document.getElementById('morseInput').value.trim();
    const morseChars = morseInput.split(' ');
    let textOutput = '';

    for (let morseChar of morseChars) {
        if (textDictionary[morseChar]) {
            textOutput += textDictionary[morseChar];
        } else {
            textOutput += '?'; 
        }
    }

    document.getElementById('textOutput').textContent = textOutput;
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}