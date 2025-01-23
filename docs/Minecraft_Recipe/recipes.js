// scripts/recipes.js

// Fetch the recipe data from the API
fetch('https://minecraft-api.vercel.app/api/recipes')
    .then(response => response.json())
    .then(recipes => {
        const recipeContainer = document.getElementById('recipes');
        recipes.forEach(recipe => {
            const recipeDiv = document.createElement('div');
            recipeDiv.className = 'recipe';
            recipeDiv.innerHTML = `
                <img src="${recipe.image}" alt="${recipe.name}">
                <h3>${recipe.name}</h3>
                <p>${recipe.description}</p>
            `;
            recipeContainer.appendChild(recipeDiv);
        });
    })
    .catch(error => console.error('Error fetching recipes:', error));
