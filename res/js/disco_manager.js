// musicPlayerDisco.js

class DiscoManager {
    /**
     * @param {string} discoSelector CSS 选择器指向 #disco 元素
     * @param {string} coverSelector CSS 选择器指向 #disco_cover 元素
     */
    constructor() {
        this.discoElement = document.getElementById("disco");
        this.coverElement = document.getElementById("disco_cover");
        
        if (!this.discoElement || !this.coverElement) {
            console.error("无法找到指定的 DOM 元素。请检查选择器。");
            return;
        }

        // 默认旋转速率 (角度/秒)。负值表示反向旋转。
        this.rotationRateDegreesPerSecond = 15; // 90度/秒
        this.isPlaying = false;
        
        this.lastTime = null; // 用于 tracking requestAnimationFrame 的时间
        this.animationId = null; // 用于停止 rAF
        this.currentRotation = 0; // 当前旋转角度

        // 绑定 this 到 animationLoop，防止上下文丢失
        this.animationLoop = this.animationLoop.bind(this);
    }

    /**
     * 【核心】使用 requestAnimationFrame 直接控制旋转
     * @param {number} timestamp 当前时间戳 (由 rAF 提供)
     */
    animationLoop(timestamp) {
        if (!this.isPlaying) return;

        if (!this.lastTime) this.lastTime = timestamp;

        const deltaTime = (timestamp - this.lastTime) / 1000; // 转换为秒
        this.lastTime = timestamp;

        // 根据帧间隔时间和速率计算新的旋转角度
        // 角度 = 角度 + (速率 * 时间间隔)
        this.currentRotation += this.rotationRateDegreesPerSecond * deltaTime;

        // 使用 transform 设置旋转
        this.discoElement.style.transform = `rotate(${this.currentRotation}deg)`;

        // 循环调用下一帧
        this.animationId = requestAnimationFrame(this.animationLoop);
    }

    /**
     * 设置唱片旋转速率
     * @param {number} degreesPerSecond 每秒旋转角度 (例如 90度/秒)
     */
    setRotationRate(degreesPerSecond) {
        this.rotationRateDegreesPerSecond = degreesPerSecond;
        console.log(`旋转速度更新为 ${degreesPerSecond} 度/秒`);
    }

    /**
     * 为 disco 加载封面图片
     * @param {string} imageUrl 图片 URL 或 Base64 Data URI
     */
    setCover(imageUrl) {
        if (this.coverElement) {
            this.coverElement.innerHTML = ''; 
            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.alt = "Album Cover";
            this.coverElement.appendChild(imgElement);
            console.log("封面已加载。");
        }
    }

    /**
     * 控制 disco 是否旋转 (播放/暂停)
     * @param {boolean} play 是否开始旋转
     */
    toggleRotation(play) {
        if (this.isPlaying === play) return; // 避免重复启动/停止

        this.isPlaying = play;

        if (play) {
            console.log("开始旋转 (JS rAF 控制)");
            // 启动 rAF 循环
            this.lastTime = null; // 重置时间，防止启动时跳帧
            this.animationId = requestAnimationFrame(this.animationLoop);
        } else {
            console.log("暂停旋转");
            // 停止 rAF 循环
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
    }
}

// 导出类
window.DiscoManager = DiscoManager;
