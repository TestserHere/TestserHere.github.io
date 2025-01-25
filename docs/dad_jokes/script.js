// Select the joke container and button elements
const jokeEl = document.getElementById('joke');
const jokeBtn = document.getElementById('jokeBtn');

// Check if the elements exist
if (!jokeEl || !jokeBtn) {
  console.error('Error: Could not find one or more required elements.');
} else {
  // Add a click event listener to the button
  jokeBtn.addEventListener('click', generateJoke);

  // Call generateJoke once on page load
  generateJoke();

  // Function to fetch and display a joke using async/await
  async function generateJoke() {
    const config = {
      headers: {
        Accept: 'application/json', // Specify that we want JSON in response
      },
    };

    // Disable the button while fetching the joke
    jokeBtn.disabled = true;
    jokeBtn.textContent = 'Loading...';

    try {
      // Fetch a dad joke from the API
      const res = await fetch('https://icanhazdadjoke.com', config);

      // Check if the response is OK, else throw an error
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      // Parse the JSON response
      const data = await res.json();

      // Update the joke container with the joke
      jokeEl.innerHTML = data.joke;
    } catch (error) {
      // Display an error message in case of a failure
      jokeEl.innerHTML = 'Failed to load joke. Please try again!';
      console.error('Error fetching joke:', error);
    } finally {
      // Re-enable the button and reset its text
      jokeBtn.disabled = false;
      jokeBtn.textContent = 'Get Another Joke';
    }
  }
}
