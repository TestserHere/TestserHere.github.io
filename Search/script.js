const API_KEY = 'AIzaSyCPIjZWQkpsSazxahqNUDPAMD8c7FCJlmI'; // Replace with your API key
const SEARCH_ENGINE_ID = 'f584625ca9f8a43db'; // Replace with your Search Engine ID

// Retrieve the saved keyword from session storage
const result = sessionStorage.getItem("keyword");

// Check if a result exists, and trigger a search automatically
if (result) {
    searchQuery(result);
}

document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault(); // Prevent form submission

    const query = document.getElementById('search-input').value;
    searchQuery(query);
});

function searchQuery(query) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => displayResults(data))
        .catch(error => console.error('Error:', error));
}

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Clear previous results

    if (data.items) {
        data.items.forEach(item => {
            const resultItem = `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title"><a href="${item.link}" target="_blank">${item.title}</a></h5>
                        <p class="card-text">${item.snippet}</p>
                    </div>
                </div>`;
            resultsDiv.innerHTML += resultItem;
        });
    } else {
        resultsDiv.innerHTML = '<p>No results found.</p>';
    }
}
