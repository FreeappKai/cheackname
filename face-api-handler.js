// ==========================================
// FACE RECOGNITION HANDLER
// Using face-api.js
// ==========================================

let faceApiLoaded = false;
let labeledDescriptors = [];
let faceMatcher = null;
let video = null;
let canvas = null;
let displaySize = null;
let detectionRunning = false;

const CONFIDENCE_THRESHOLD_AUTO = 0.6;
const CONFIDENCE_THRESHOLD_MANUAL = 0.45;

// ==========================================
// INITIALIZE FACE RECOGNITION
// ==========================================

async function initFaceRecognition() {
    try {
        updateStatus('กำลังโหลดโมเดล AI...', 'info');

        // Load face-api.js models from CDN
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        faceApiLoaded = true;
        updateStatus('โหลดโมเดลสำเร็จ', 'success');

        // Load student face data
        await loadStudentFaceData();

        // Start video stream
        await startVideo();

        // Start detection
        startDetection();

    } catch (error) {
        console.error('Face API initialization error:', error);
        updateStatus('เกิดข้อผิดพลาดในการโหลด AI: ' + error.message, 'error');
    }
}

// ==========================================
// LOAD STUDENT FACE DATA
// ==========================================

async function loadStudentFaceData() {
    try {
        updateStatus('กำลังโหลดข้อมูลนักเรียน...', 'info');

        // Get students with images
        const result = await API.getStudents({ class: currentClass });

        if (!result.success || !result.data) {
            throw new Error('Failed to load student data');
        }

        const students = result.data.filter(s => s.ImageUrl);

        if (students.length === 0) {
            updateStatus('ไม่พบรูปภาพนักเรียน กรุณาใช้โหมดเช็คชื่อด้วยตนเอง', 'warning');
            return;
        }

        updateStatus(`กำลังประมวลผลใบหน้า ${students.length} คน...`, 'info');

        // Load face descriptors for each student
        labeledDescriptors = [];

        for (const student of students) {
            try {
                const img = await faceapi.fetchImage(student.ImageUrl);
                const detection = await faceapi
                    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    labeledDescriptors.push(
                        new faceapi.LabeledFaceDescriptors(
                            student.StudentID,
                            [detection.descriptor]
                        )
                    );
                }
            } catch (error) {
                console.error(`Failed to load face for ${student.StudentID}:`, error);
            }
        }

        if (labeledDescriptors.length === 0) {
            updateStatus('ไม่สามารถตรวจจับใบหน้าในรูปได้ กรุณาใช้โหมดเช็คชื่อด้วยตนเอง', 'warning');
            return;
        }

        // Create face matcher
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.65);

        updateStatus(`พร้อมใช้งาน - ตรวจจับได้ ${labeledDescriptors.length} คน`, 'success');

        // Update total students count
        document.getElementById('totalStudents').textContent = labeledDescriptors.length;

    } catch (error) {
        console.error('Load student face data error:', error);
        updateStatus('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message, 'error');
    }
}

// ==========================================
// VIDEO STREAM
// ==========================================

async function startVideo() {
    try {
        video = document.getElementById('videoElement');
        canvas = document.getElementById('overlay');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(canvas, displaySize);
                resolve();
            };
        });
    } catch (error) {
        console.error('Video stream error:', error);
        updateStatus('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง', 'error');
        throw error;
    }
}

// ==========================================
// FACE DETECTION LOOP
// ==========================================

async function startDetection() {
    if (!faceApiLoaded || !faceMatcher) {
        return;
    }

    detectionRunning = true;

    const detect = async () => {
        if (!detectionRunning) return;

        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            // Clear canvas
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);

            if (detections.length > 0) {
                // Resize detections to match display size
                const resizedDetections = faceapi.resizeResults(detections, displaySize);

                // Draw face boxes
                resizedDetections.forEach(detection => {
                    const box = detection.detection.box;

                    // Draw bounding box
                    context.strokeStyle = '#F59E0B'; // Amber
                    context.lineWidth = 3;
                    context.strokeRect(box.x, box.y, box.width, box.height);
                });

                // Try to recognize faces
                for (const detection of detections) {
                    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

                    if (bestMatch.label !== 'unknown') {
                        const confidence = 1 - bestMatch.distance;

                        if (confidence >= CONFIDENCE_THRESHOLD_AUTO) {
                            // Auto check-in
                            await handleFaceRecognition(bestMatch.label, confidence, 'auto');
                            detectionRunning = false;
                        } else if (confidence >= CONFIDENCE_THRESHOLD_MANUAL) {
                            // Require teacher confirmation
                            await handleFaceRecognition(bestMatch.label, confidence, 'manual');
                            detectionRunning = false;
                        }
                    }
                }

                updateStatus('🔍 ตรวจพบใบหน้า ' + detections.length + ' คน', 'info');
            } else {
                updateStatus('🔍 กำลังค้นหาใบหน้า...', 'info');
            }

        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue detection loop
        setTimeout(() => requestAnimationFrame(detect), 100);
    };

    detect();
}

// ==========================================
// HANDLE RECOGNITION
// ==========================================

async function handleFaceRecognition(studentId, confidence, mode) {
    try {
        // Get student info
        const studentResult = await API.getStudents({ studentId: studentId });

        if (!studentResult.success || studentResult.data.length === 0) {
            updateStatus('ไม่พบข้อมูลนักเรียน', 'error');
            detectionRunning = true;
            startDetection();
            return;
        }

        const student = studentResult.data[0];

        // Show recognition box with green color
        const context = canvas.getContext('2d');
        context.strokeStyle = '#22C55E'; // Green
        context.lineWidth = 4;

        if (mode === 'auto') {
            // Auto check-in
            await recordAttendance(student);
        } else {
            // Manual confirmation
            const confirmed = confirm(
                `ตรวจพบ: ${student.Name}\n` +
                `รหัส: ${student.StudentID}\n` +
                `ความเชื่อมั่น: ${(confidence * 100).toFixed(1)}%\n\n` +
                `ยืนยันการเช็คชื่อหรือไม่?`
            );

            if (confirmed) {
                await recordAttendance(student);
            } else {
                detectionRunning = true;
                startDetection();
            }
        }

    } catch (error) {
        console.error('Recognition handling error:', error);
        updateStatus('เกิดข้อผิดพลาด', 'error');
        detectionRunning = true;
        startDetection();
    }
}

async function recordAttendance(student) {
    // Check duplicate
    const duplicate = await API.checkDuplicateAttendance({
        studentId: student.StudentID,
        date: new Date().toISOString().split('T')[0],
        period: currentPeriod,
        subject: currentSubject
    });

    if (duplicate.isDuplicate) {
        updateStatus('นักเรียนคนนี้เช็คชื่อแล้ว', 'warning');
        Utils.showNotification('นักเรียนคนนี้เช็คชื่อในคาบนี้แล้ว', 'warning');

        // Resume detection after 3 seconds
        setTimeout(() => {
            detectionRunning = true;
            startDetection();
        }, 3000);
        return;
    }

    // Record attendance
    const result = await API.recordAttendance({
        studentId: student.StudentID,
        studentCode: student.StudentCode,
        name: student.Name,
        class: student.Class,
        subject: currentSubject,
        period: currentPeriod,
        date: new Date().toISOString().split('T')[0],
        status: 'PRESENT',
        method: 'AUTO_FACE',
        recordedBy: currentUser.userId
    });

    if (result.success) {
        updateStatus('✅ เช็คชื่อสำเร็จ', 'success');
        Utils.showNotification('เช็คชื่อสำเร็จ', 'success');

        // Show success modal
        showSuccessModal({
            studentId: student.StudentID,
            name: student.Name,
            class: student.Class
        });

        // Reload attendance data
        await loadStudentsAndAttendance();

        // Resume detection after 3 seconds
        setTimeout(() => {
            detectionRunning = true;
            startDetection();
        }, 3000);
    } else {
        updateStatus('❌ เกิดข้อผิดพลาด: ' + result.error, 'error');
        Utils.showNotification('เกิดข้อผิดพลาด', 'error');

        setTimeout(() => {
            detectionRunning = true;
            startDetection();
        }, 3000);
    }
}

// ==========================================
// UI HELPERS
// ==========================================

function updateStatus(message, type = 'info') {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;

    indicator.textContent = message;

    // Update color based on type
    indicator.className = 'absolute top-4 left-4 px-4 py-2 bg-opacity-90 backdrop-blur-sm rounded-full text-white font-kanit text-sm z-10 ';

    switch (type) {
        case 'success':
            indicator.className += 'bg-green-500';
            break;
        case 'error':
            indicator.className += 'bg-red-500';
            break;
        case 'warning':
            indicator.className += 'bg-yellow-500';
            break;
        default:
            indicator.className += 'bg-blue-500';
    }
}

// Camera switch (front/back)
document.getElementById('cameraSwitch')?.addEventListener('click', async function () {
    // Stop current stream
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    // Try to switch camera (implementation depends on device capabilities)
    updateStatus('การสลับกล้องยังไม่รองรับ', 'warning');
});
