// Retired: the Google search key was removed from the site.

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
    document.getElementById('results').innerHTML = '<p>Search is no longer available.</p>';
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
