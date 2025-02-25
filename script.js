document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const resultSection = document.getElementById('resultSection');
    const results = document.getElementById('results');
    const uploadBtn = document.querySelector('.upload-btn');

    // Add loading animation styles
    const style = document.createElement('style');
    style.textContent = `
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            gap: 1rem;
        }

        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 4px solid var(--secondary);
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .result-card {
            padding: 2rem;
            border-radius: var(--radius-lg);
            background: white;
            box-shadow: 0 4px 20px var(--shadow);
            animation: fadeIn 0.5s ease;
        }

        .condition {
            font-size: 1.75rem;
            color: var(--primary-dark);
            margin-bottom: 1rem;
            font-weight: 600;
        }

        .probability {
            font-size: 1.25rem;
            color: var(--text);
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border);
        }

        .all-probabilities {
            margin-top: 2rem;
        }

        .probability-item {
            display: flex;
            align-items: center;
            margin: 1rem 0;
            gap: 1rem;
        }

        .condition-name {
            width: 250px;
            font-size: 1rem;
            color: var(--text);
            font-weight: 500;
        }

        .probability-bar {
            flex-grow: 1;
            height: 12px;
            background: var(--secondary);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }

        .probability-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 6px;
            transition: width 1s ease;
            position: absolute;
            top: 0;
            left: 0;
        }

        .probability-value {
            width: 70px;
            text-align: right;
            font-size: 1rem;
            font-weight: 500;
            color: var(--text);
        }

        .error-message {
            color: var(--danger);
            padding: 1rem;
            background: #ffebee;
            border-radius: var(--radius-md);
            margin-top: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .image-preview {
            margin: 2rem 0;
            display: none;
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: 0 4px 20px var(--shadow);
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .image-preview.show {
            opacity: 1;
            transform: translateY(0);
        }

        .image-preview img {
            width: 100%;
            height: auto;
            display: block;
            transform: scale(1);
            transition: transform 0.3s ease;
        }

        .image-preview:hover img {
            transform: scale(1.02);
        }

        .upload-btn {
            background: var(--primary);
            color: white;
            padding: 1.2rem 2.5rem;
            border: none;
            border-radius: var(--radius-md);
            font-size: 1.1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .upload-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s ease, height 0.6s ease;
        }

        .upload-btn:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .upload-btn:hover::before {
            width: 300px;
            height: 300px;
        }

        .upload-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .upload-btn .btn-text {
            position: relative;
            z-index: 1;
        }

        #imageInput {
            display: none;
        }
    `;

    document.head.appendChild(style);

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Analyzing image...</p>
    `;

    // Image upload handling
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    imagePreview.style.display = 'block';
                    // Add a small delay before adding the show class to trigger the animation
                    setTimeout(() => {
                        imagePreview.classList.add('show');
                    }, 50);
                    uploadImage(file);
                }
                reader.readAsDataURL(file);
            }
        });
    }

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        // Show loading state
        resultSection.style.display = 'block';
        results.innerHTML = '';
        results.appendChild(loadingIndicator);

        try {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Please select a valid image file.');
            }

            const response = await fetch('http://localhost:5000/predict', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Server returned an unsuccessful response');
            }

            if (!data.predicted_class || !data.all_probabilities || typeof data.probability !== 'number') {
                throw new Error('Invalid response format: missing required prediction data');
            }

            // Sort probabilities in descending order
            const sortedProbabilities = Object.entries(data.all_probabilities)
                .sort(([,a], [,b]) => b - a);

            // Create result card
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';

            // Display primary diagnosis
            resultCard.innerHTML = `
                <h3>Primary Diagnosis</h3>
                <div class="condition">${data.predicted_class}</div>
                <div class="probability">Confidence: ${data.probability}%</div>
                <div class="all-probabilities">
                    <h4>Detailed Analysis</h4>
                </div>
            `;

            // Add probability bars for all classes
            const probabilitiesContainer = resultCard.querySelector('.all-probabilities');
            sortedProbabilities.forEach(([condition, probability]) => {
                const probabilityItem = document.createElement('div');
                probabilityItem.className = 'probability-item';
                probabilityItem.innerHTML = `
                    <div class="condition-name">${condition}</div>
                    <div class="probability-bar">
                        <div class="probability-fill" style="width: ${probability}%"></div>
                    </div>
                    <div class="probability-value">${probability}%</div>
                `;
                probabilitiesContainer.appendChild(probabilityItem);
            });

            // Clear results and show new prediction
            results.innerHTML = '';
            results.appendChild(resultCard);

        } catch (error) {
            resultSection.style.display = 'block';
            results.innerHTML = `
                <div class="error-message">
                    ${error.message || 'An error occurred during prediction. Please try again.'}
                </div>
            `;
        }
    }

    // Header scroll effect
    let lastScroll = 0;
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll <= 0) {
            header.classList.remove('scroll-up');
            return;
        }
        
        if (currentScroll > lastScroll && !header.classList.contains('scroll-down')) {
            // Scroll down
            header.classList.remove('scroll-up');
            header.classList.add('scroll-down');
        } else if (currentScroll < lastScroll && header.classList.contains('scroll-down')) {
            // Scroll up
            header.classList.remove('scroll-down');
            header.classList.add('scroll-up');
        }
        
        lastScroll = currentScroll;
    });
});