document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const cameraError = document.getElementById('camera-error');
    const instructions = document.getElementById('instructions');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const fileInput = document.getElementById('qr-file-input');
    const resultsList = document.getElementById('results-list');
    const noResults = document.getElementById('no-results');
    const codesCount = document.getElementById('codes-count');
    const clearAllBtn = document.getElementById('clear-all');
    const copyAllBtn = document.getElementById('copy-all');

    let scanning = true;
    let stream = null;
    let scannedCodes = new Set();
    let lastProcessedTime = 0;
    const PROCESS_INTERVAL = 100; // Интервал между обработкой кадров (мс)

    async function checkCameraSupport() {
        console.log('Checking camera support...');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('MediaDevices API not supported');
            throw new Error('Camera API is not supported in this browser');
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('All devices:', devices);

            const cameras = devices.filter(device => device.kind === 'videoinput');
            console.log('Available cameras:', cameras.map(camera => ({
                label: camera.label || 'Unnamed camera',
                deviceId: camera.deviceId,
                kind: camera.kind
            })));

            if (cameras.length === 0) {
                console.log('No camera devices found');
                throw new Error('No camera devices found');
            }

            return cameras;
        } catch (error) {
            console.error('Error enumerating devices:', error);
            throw error;
        }
    }

    async function setupCamera() {
        try {
            const cameras = await checkCameraSupport();
            console.log('Setting up camera with available devices:', cameras.length);

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: "environment",
                        width: 640,
                        height: 480
                    }
                });
                console.log('Camera initialized with resolution:', {
                    width: stream.getVideoTracks()[0].getSettings().width,
                    height: stream.getVideoTracks()[0].getSettings().height
                });
            } catch (err) {
                console.log('Falling back to default camera:', err);
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 640,
                        height: 480
                    }
                });
                console.log('Successfully initialized default camera');
            }

            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            await video.play();
            requestAnimationFrame(tick);

            cameraError.classList.add('d-none');
            instructions.classList.remove('d-none');
            fileUploadContainer.classList.add('d-none');

        } catch (err) {
            console.error('Camera setup error:', err);
            handleCameraError(err);
        }
    }

    function tick() {
        if (!scanning) return;

        const currentTime = Date.now();
        if (currentTime - lastProcessedTime < PROCESS_INTERVAL) {
            requestAnimationFrame(tick);
            return;
        }

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d', { alpha: false });

            // Очищаем canvas перед новой отрисовкой
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert"
                });

                if (code && !scannedCodes.has(code.data)) {
                    handleSuccess(code.data);
                }

                lastProcessedTime = currentTime;
            } catch (err) {
                console.error('QR scanning error:', err);
            }
        }
        requestAnimationFrame(tick);
    }

    function handleSuccess(data) {
        if (scannedCodes.has(data)) return;
        scannedCodes.add(data);

        const displayData = data.includes('=') ? data.split('=')[1] : data;

        const resultItem = document.createElement('div');
        resultItem.className = 'list-group-item slide-in';
        resultItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="text-truncate">${displayData}</div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light copy-btn">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-light delete-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        resultItem.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(displayData)
                .then(() => {
                    const icon = resultItem.querySelector('.copy-btn i');
                    icon.className = 'fas fa-check';
                    setTimeout(() => {
                        icon.className = 'fas fa-copy';
                    }, 1000);
                });
        });

        resultItem.querySelector('.delete-btn').addEventListener('click', () => {
            scannedCodes.delete(data);
            resultItem.classList.add('fade-out');
            setTimeout(() => {
                resultItem.remove();
                updateResultsView();
            }, 200);
        });

        resultsList.insertBefore(resultItem, resultsList.firstChild);
        updateResultsView();
    }

    function updateResultsView() {
        const count = scannedCodes.size;
        codesCount.textContent = count;
        noResults.style.display = count === 0 ? 'block' : 'none';
        copyAllBtn.disabled = count === 0;
    }

    copyAllBtn.addEventListener('click', () => {
        const allResults = Array.from(resultsList.children)
            .map(item => item.querySelector('.text-truncate').textContent)
            .join('\n');

        navigator.clipboard.writeText(allResults)
            .then(() => {
                const originalText = copyAllBtn.innerHTML;
                copyAllBtn.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
                setTimeout(() => {
                    copyAllBtn.innerHTML = originalText;
                }, 1000);
            });
    });

    clearAllBtn.addEventListener('click', () => {
        scannedCodes.clear();
        resultsList.innerHTML = '';
        updateResultsView();
    });

    window.addEventListener('beforeunload', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });

    setupCamera();
});