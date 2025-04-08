// app.js
document.addEventListener('DOMContentLoaded', () => {
    // API URL (change this to your actual API endpoint)
    const API_URL = 'http://localhost:5000/api';
    
    // DOM elements
    const searchInput = document.getElementById('food-search');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const toxinLabelContainer = document.getElementById('toxin-label');
    
    // Templates
    const noResultsTemplate = document.getElementById('no-results-template');
    const resultsTemplate = document.getElementById('results-template');
    const foodItemTemplate = document.getElementById('food-item-template');
    const labelTemplate = document.getElementById('label-template');
    const toxinItemTemplate = document.getElementById('toxin-item-template');
    const errorTemplate = document.getElementById('error-template');
    
    // Event Listeners
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
    
    // Initialize
    searchInput.focus();
    
    // Functions
    async function handleSearch() {
      const query = searchInput.value.trim();
      
      if (query.length === 0) {
        return;
      }
      
      // Clear previous results
      searchResults.innerHTML = '';
      toxinLabelContainer.innerHTML = '';
      
      try {
        const endpoint = `${API_URL}/foods/search?query=${encodeURIComponent(query)}`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error('Failed to fetch search results');
        }
        
        const foods = await response.json();
        displaySearchResults(foods);
        
      } catch (error) {
        console.error('Search error:', error);
        searchResults.appendChild(errorTemplate.content.cloneNode(true));
      }
    }
    
    function displaySearchResults(foods) {
      if (foods.length === 0) {
        searchResults.appendChild(noResultsTemplate.content.cloneNode(true));
        return;
      }
      
      const resultsFragment = resultsTemplate.content.cloneNode(true);
      const foodList = resultsFragment.querySelector('.food-list');
      
      foods.forEach(food => {
        const foodItem = foodItemTemplate.content.cloneNode(true);
        const foodLink = foodItem.querySelector('.food-link');
        
        foodLink.textContent = food.name;
        foodLink.addEventListener('click', () => fetchFoodDetails(food.id));
        
        foodList.appendChild(foodItem);
      });
      
      searchResults.appendChild(resultsFragment);
    }
    
    async function fetchFoodDetails(foodId) {
      try {
        // Clear previous label
        toxinLabelContainer.innerHTML = '';
        
        const endpoint = `${API_URL}/foods/${foodId}`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error('Failed to fetch food details');
        }
        
        const food = await response.json();
        displayToxinLabel(food);
        
        // Scroll to the label
        toxinLabelContainer.scrollIntoView({ behavior: 'smooth' });
        
      } catch (error) {
        console.error('Food details error:', error);
        toxinLabelContainer.appendChild(errorTemplate.content.cloneNode(true));
      }
    }
    
    function displayToxinLabel(food) {
      // If there are no toxins, don't display a label
      if (!food.toxins || food.toxins.length === 0) {
        const errorMsg = errorTemplate.content.cloneNode(true);
        const errorP = errorMsg.querySelector('p');
        errorP.textContent = 'No toxin information available for this food.';
        toxinLabelContainer.appendChild(errorMsg);
        return;
      }
      
      const labelFragment = labelTemplate.content.cloneNode(true);
      
      // Set serving size
      labelFragment.querySelector('.serving-size').textContent = food.serving_size;
      
      // Add toxins
      const toxinList = labelFragment.querySelector('.toxin-list');
      
      food.toxins.forEach(toxin => {
        const toxinItem = toxinItemTemplate.content.cloneNode(true);
        
        // Calculate percent of daily value
        let percentDV = 0;
        if (toxin.daily_value && toxin.daily_value > 0) {
          percentDV = (toxin.amount / toxin.daily_value) * 100;
        }
        
        // Format amount with unit
        const formattedAmount = `${toxin.amount} ${toxin.unit}`;
        
        // Format percent
        const formattedPercent = percentDV.toFixed(1) + '%';
        
        // Set toxin data
        toxinItem.querySelector('.toxin-name').textContent = toxin.name;
        toxinItem.querySelector('.toxin-amount').textContent = formattedAmount;
        
        const percentElement = toxinItem.querySelector('.toxin-percent');
        percentElement.textContent = formattedPercent;
        
        // Add color coding based on percentage of daily value
        if (percentDV >= 75) {
          percentElement.classList.add('danger-high');
        } else if (percentDV >= 25) {
          percentElement.classList.add('danger-medium');
        } else {
          percentElement.classList.add('danger-low');
        }
        
        toxinList.appendChild(toxinItem);
      });
      
      toxinLabelContainer.appendChild(labelFragment);
    }
  });