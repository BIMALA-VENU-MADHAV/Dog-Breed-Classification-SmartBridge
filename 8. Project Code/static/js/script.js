// static/js/script.js
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const predictBtn = document.getElementById('predict-btn');
const resetBtn = document.getElementById('reset-btn');
const form = document.getElementById('upload-form');
const loader = document.getElementById('loader');
const resultArea = document.getElementById('result-area');
const resultText = document.getElementById('prediction-result');
const toast = document.getElementById('toast');
const removeImageBtn = document.getElementById('remove-image-btn');
const recentPredictions = document.getElementById('recent-predictions');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const predictionCount = document.querySelector('.recent-predictions-header .count');

const uploadOverlay = document.querySelector('.upload-overlay');
const circularProgress = document.querySelector('.circular-progress');
const progressCircle = circularProgress.querySelector('.progress');
const uploadStatus = document.querySelector('.upload-status');
const uploadPercentage = document.querySelector('.upload-percentage');

let selectedFile = null;
let selectedImageData = null;

// Initialize IndexedDB
const dbName = 'DogVisionDB';
const storeName = 'predictions';
let db;

const initDB = () => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadRecentPredictions();
    };
};

// Delete single prediction
const deletePrediction = (id) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(id).onsuccess = () => {
        loadRecentPredictions();
        showToast('Prediction deleted', 'success');
    };
};

// Clear all history
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all prediction history?')) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear().onsuccess = () => {
            loadRecentPredictions();
            showToast('History cleared successfully', 'success');
        };
    }
});



// Calculate circle circumference
const radius = 16;
const circumference = 2 * Math.PI * radius;
progressCircle.style.strokeDasharray = circumference;
progressCircle.style.strokeDashoffset = circumference;

// Show preview and enable predict
const showPreview = (imageData) => {
    selectedImageData = imageData;
    preview.src = imageData;
    preview.style.display = 'block';
    removeImageBtn.style.display = 'flex';
    predictBtn.disabled = false;
    predictBtn.classList.add('enabled');
    dropArea.classList.add('has-image');
    document.querySelector('.preview-container').style.display = 'flex';
};

// Update progress circle
const updateProgress = (percent) => {
    const offset = circumference - (percent / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
    uploadPercentage.textContent = `${Math.round(percent)}%`;
};

// Show upload progress
const showUploadProgress = () => {
    uploadOverlay.style.display = 'flex';
    circularProgress.style.display = 'block';
    uploadPercentage.style.display = 'block';
    dropArea.classList.add('uploading');

    let progress = 0;
    const interval = setInterval(() => {
        progress += 2;
        updateProgress(progress);

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                uploadPercentage.style.opacity = '0';
                circularProgress.classList.add('done');
                uploadStatus.textContent = 'Upload complete!';

                setTimeout(() => {
                    uploadOverlay.style.display = 'none';
                    circularProgress.style.display = 'none';
                    circularProgress.classList.remove('done');
                    dropArea.classList.remove('uploading');
                    uploadStatus.textContent = 'Uploading image...';
                    uploadPercentage.style.display = 'none';
                    uploadPercentage.style.opacity = '1';
                    uploadPercentage.textContent = '0%';
                    progressCircle.style.strokeDashoffset = circumference;
                }, 2000);
            }, 200);
        }
    }, 30);
};

// File Preview
fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
            showUploadProgress();
            setTimeout(() => {
                showPreview(reader.result);
            }, 2000);
        };
        reader.readAsDataURL(selectedFile);
    }
});

// Reset preview
const resetPreview = () => {
    preview.src = '';
    preview.style.display = 'none';
    removeImageBtn.style.display = 'none';
    fileInput.value = '';
    selectedFile = null;
    selectedImageData = null;
    predictBtn.disabled = true;
    predictBtn.classList.remove('enabled');
    resultArea.style.display = 'none';
    resultText.innerHTML = '';
    dropArea.classList.remove('has-image');
    document.querySelector('.preview-container').style.display = 'none';
    uploadOverlay.style.display = 'none';
    circularProgress.style.display = 'none';
    circularProgress.classList.remove('done');
    dropArea.classList.remove('uploading');
    uploadStatus.textContent = 'Uploading image...';
    uploadPercentage.style.display = 'none';
    uploadPercentage.style.opacity = '1';
    uploadPercentage.textContent = '0%';
    progressCircle.style.strokeDashoffset = circumference;
};

// Remove image
removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPreview();
});

// Click to upload
dropArea.addEventListener('click', (e) => {
    // prevent reopening picker when clicking remove button or preview
    if (e.target.closest('#remove-image-btn')) return;
    fileInput.click();
});

// Drag & Drop
['dragenter', 'dragover'].forEach(event => {
    dropArea.addEventListener(event, (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-active');
    });
});

['dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-active');
    });
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
    }
});


// Show toast
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// Submit form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (
    !selectedImageData ||
    !selectedImageData.startsWith("data:image")
  ) {
    showToast("Please upload a valid image", "error");
    return;
  }

  loader.style.display = 'block';
  resultText.innerHTML = '';
  resultArea.style.display = 'block';

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: selectedImageData
      })
    });

    let data = {};
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned invalid JSON");
      }
    }

    loader.style.display = 'none';

    if (!response.ok) {
      const errorMsg = data.error || "Prediction failed";
      resultText.innerHTML = `<strong>Error:</strong> ${errorMsg}`;
      showToast(errorMsg, 'error');
      return;
    }

    resultText.innerHTML = `
      <div class="prediction-result">
        <div class="breed-name">${data.breed}</div>
        <div class="confidence-score">
          <div class="confidence-bar" style="width: ${data.confidence}%"></div>
          <span>${data.confidence}% confident</span>
        </div>
      </div>
    `;

    savePrediction(selectedImageData, data.breed, data.confidence);
    showToast("Prediction complete!");

  } catch (error) {
    loader.style.display = 'none';
    resultText.innerHTML = `<strong>Error:</strong> ${error.message}`;
    showToast(error.message, 'error');
  }
});



// Reset form
resetBtn.addEventListener('click', resetPreview);

// Load recent predictions from IndexedDB
const loadRecentPredictions = () => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index('timestamp');

    const request = index.openCursor(null, 'prev');
    let count = 0;

    recentPredictions.innerHTML = '';

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < 5) {
            const prediction = cursor.value;
            const div = document.createElement('div');
            div.className = 'recent-prediction';
            div.innerHTML = `
                <img src="${prediction.imageData}" alt="Recent prediction" />
                <button type="button" class="delete-btn" aria-label="Delete prediction">
                    <i class="fas fa-times"></i>
                </button>
                <div class="prediction-info">
                    <strong>${prediction.breed}</strong>
                    <span>${prediction.confidence}% confidence</span>
                    <span class="timestamp">${new Date(prediction.timestamp).toLocaleString()}</span>
                </div>
            `;

            // Add click handler for the prediction
            div.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    showPreview(prediction.imageData);
                }
            });

            // Add click handler for delete button
            const deleteBtn = div.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this prediction?')) {
                    deletePrediction(prediction.id);
                }
            });

            recentPredictions.appendChild(div);
            count++;
            cursor.continue();
        } else if (count === 0) {
            recentPredictions.innerHTML = `
                <div class="recent-predictions-empty">
                    <i class="fas fa-image" style="font-size: 2rem; color: #999; margin-bottom: 1rem;"></i>
                    <p>No predictions yet. Try uploading an image!</p>
                </div>
            `;
        }
        // Update prediction count
        predictionCount.textContent = count;
    };
};

// Save prediction to IndexedDB
const savePrediction = (imageData, breed, confidence) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const prediction = {
        imageData,
        breed,
        confidence,
        timestamp: new Date().getTime()
    };

    store.add(prediction).onsuccess = () => {
        loadRecentPredictions();
    };
};

// Initialize preview state
resetPreview();

// Initialize IndexedDB when the page loads
initDB();
