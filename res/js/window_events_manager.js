class Window_Events_Manager {
  constructor() {
    this.callbacks = {
      onMouseEnter: null,
      onMouseLeave: null,
      onMouseFocus: null,
      onMouseBlur: null,
    };
    this._init();
  }

  _init() {
    // window.addEventListener("mouseenter", () => {
    //   this.callbacks.onMouseEnter?.();
    // });
    // window.addEventListener("mouseleave", () => {
    //   this.callbacks.onMouseLeave?.();
    // });
    window.addEventListener("focus", () => {
      this.callbacks.onMouseFocus?.();
    });
    window.addEventListener("blur", () => {
      this.callbacks.onMouseBlur?.();
    });
    window.addEventListener("mouseover", (e) => {
      // 只有当从窗口外部进入时触发
      if (!e.relatedTarget) {
        this.callbacks.onMouseEnter?.();
      }
    });
    window.addEventListener("mouseout", (e) => {
      // 只有当真正离开窗口（而不是移动到子元素）时触发
      if (!e.relatedTarget) {
        this.callbacks.onMouseLeave?.();
      }
    });
  }
}

window.Window_Events_Manager = Window_Events_Manager;
