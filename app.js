// ==========================================
// SMART ATTENDANCE SYSTEM - FRONTEND APP
// FREEMAN STUDIO BY KRUKAI
// ==========================================

// Configure API endpoint (change this to your deployed Web App URL)
const API_URL = 'https://script.google.com/macros/s/AKfycbz6ymivLRIS3fFVoSecFLOXg3MN1iYKBxiCAsSiz3uEV--bj557nH7muifp7yPJBUjOpw/exec';

// ==========================================
// API CLIENT
// ==========================================

const API = {
    async call(action, data = {}) {
        try {
            console.log('🔵 API Call:', action, data);
            console.log('🔵 API URL:', API_URL);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...data
                })
            });

            console.log('🟢 Response status:', response.status);
            console.log('🟢 Response OK:', response.ok);

            const textResponse = await response.text();
            console.log('🟢 Raw response:', textResponse);

            const result = JSON.parse(textResponse);
            console.log('🟢 Parsed result:', result);

            return result;
        } catch (error) {
            console.error('❌ API Error:', error);
            console.error('❌ Error details:', error.message, error.stack);
            return { success: false, error: error.message };
        }
    },

    // Authentication
    async authenticateUser(data) {
        return await this.call('authenticateUser', data);
    },

    async validateSession(token) {
        return await this.call('validateSession', { token });
    },

    // Students
    async getStudents(filters = {}) {
        return await this.call('getStudents', filters);
    },

    async addStudent(data) {
        return await this.call('addStudent', data);
    },

    async updateStudent(data) {
        return await this.call('updateStudent', data);
    },

    async deleteStudent(studentId, userId) {
        return await this.call('deleteStudent', { studentId, userId });
    },

    // Teachers
    async getTeachers(filters = {}) {
        return await this.call('getTeachers', filters);
    },

    async addTeacher(data) {
        return await this.call('addTeacher', data);
    },

    async updateTeacher(data) {
        return await this.call('updateTeacher', data);
    },

    // Subjects
    async getSubjects(filters = {}) {
        return await this.call('getSubjects', filters);
    },

    async addSubject(data) {
        return await this.call('addSubject', data);
    },

    // Classes
    async getClasses(filters = {}) {
        return await this.call('getClasses', filters);
    },

    async addClass(data) {
        return await this.call('addClass', data);
    },

    // Timetable
    async getTimetable(filters = {}) {
        return await this.call('getTimetable', filters);
    },

    async addTimetableEntry(data) {
        return await this.call('addTimetableEntry', data);
    },

    async updateTimetable(data) {
        return await this.call('updateTimetable', data);
    },

    // Attendance
    async recordAttendance(data) {
        return await this.call('recordAttendance', data);
    },

    async updateAttendance(data) {
        return await this.call('updateAttendance', data);
    },

    async getAttendance(filters = {}) {
        return await this.call('getAttendance', filters);
    },

    async checkDuplicateAttendance(data) {
        return await this.call('checkDuplicateAttendance', data);
    },

    // Dashboards
    async getStudentDashboard(studentId) {
        return await this.call('getStudentDashboard', { studentId });
    },

    async getTeacherDashboard(teacherId) {
        return await this.call('getTeacherDashboard', { teacherId });
    },

    async getAdminDashboard() {
        return await this.call('getAdminDashboard');
    }
};

// ==========================================
// SESSION MANAGEMENT
// ==========================================

const Session = {
    get() {
        const userData = sessionStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    },

    set(user) {
        sessionStorage.setItem('user', JSON.stringify(user));
    },

    clear() {
        sessionStorage.removeItem('user');
    },

    isAuthenticated() {
        return this.get() !== null;
    },

    requireAuth(allowedRoles = []) {
        const user = this.get();

        if (!user) {
            window.location.href = 'index.html';
            return false;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.href = 'index.html';
            return false;
        }

        return true;
    }
};

// ==========================================
// UTILITIES
// ==========================================

const Utils = {
    formatDate(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('th-TH', options);
    },

    formatTime(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    },

    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    getStatusBadge(status) {
        const badges = {
            'PRESENT': '<span class="badge badge-success">มา</span>',
            'LATE': '<span class="badge badge-warning">มาสาย</span>',
            'ABSENT': '<span class="badge badge-danger">ขาด</span>',
            'LEAVE': '<span class="badge badge-warning">ลา</span>',
            'EARLY_LEAVE': '<span class="badge badge-warning">ออกก่อน</span>'
        };
        return badges[status] || status;
    },

    imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async compressImage(file, maxWidth = 800) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-xl z-50 animate-fade-in ${type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
                type === 'warning' ? 'bg-yellow-500' :
                    'bg-blue-500'
            } text-white font-kanit`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    showLoader() {
        const loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loader.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center">
        <div class="spinner mb-4"></div>
        <p class="text-gray-700 dark:text-gray-300 font-kanit">กำลังโหลด...</p>
      </div>
    `;
        document.body.appendChild(loader);
    },

    hideLoader() {
        const loader = document.getElementById('globalLoader');
        if (loader) {
            loader.remove();
        }
    }
};

// ==========================================
// EXPORT FOR USE IN OTHER FILES
// ==========================================

if (typeof window !== 'undefined') {
    window.API = API;
    window.Session = Session;
    window.Utils = Utils;
}

