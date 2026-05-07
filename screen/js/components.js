class CustomSelect {
    static currentOpenInstance = null;

    constructor(container, options, selectedIndex = 0, onChange) {
        this.container = container;
        this.options = options;
        this.selectedIndex = selectedIndex;
        this.onChange = onChange;
        this.isOpen = false;
        this.boundDocumentClick = this.close.bind(this);

        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = "";
        this.container.className = "custom-select";

        // 显示选中的值
        this.displayElement = document.createElement("div");
        this.displayElement.className = "custom-select-display";

        this.displayTextSpan = document.createElement("span");
        this.displayTextSpan.className = "custom-select-display-text";
        this.displayTextSpan.textContent = this.options[this.selectedIndex];

        // 下拉箭头
        const arrow = document.createElement("span");
        arrow.className = "custom-select-arrow";
        arrow.innerHTML = "&#9660;";

        this.displayElement.appendChild(this.displayTextSpan);
        this.displayElement.appendChild(arrow);
        this.container.appendChild(this.displayElement);

        // 选项列表
        this.optionsList = document.createElement("ul");
        this.optionsList.className = "custom-select-options";

        this.options.forEach((option, index) => {
            const li = document.createElement("li");
            li.className = `custom-select-option ${index === this.selectedIndex ? "custom-select-option-selected" : ""}`;
            li.textContent = option;
            li.dataset.index = index;
            this.optionsList.appendChild(li);
        });

        this.container.appendChild(this.optionsList);
    }

    bindEvents() {
        this.displayElement.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.optionsList.addEventListener("click", (e) => {
            const option = e.target.closest(".custom-select-option");
            if (option) {
                const index = parseInt(option.dataset.index);
                this.select(index);
            }
            e.stopPropagation();
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (CustomSelect.currentOpenInstance && CustomSelect.currentOpenInstance !== this) {
            CustomSelect.currentOpenInstance.close();
        }
        this.isOpen = true;
        this.container.classList.add("custom-select-open");
        this.displayElement.classList.add("custom-select-display-open");
        CustomSelect.currentOpenInstance = this;
        document.addEventListener("click", this.boundDocumentClick);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.container.classList.remove("custom-select-open");
        this.displayElement.classList.remove("custom-select-display-open");
        if (CustomSelect.currentOpenInstance === this) {
            CustomSelect.currentOpenInstance = null;
        }
        document.removeEventListener("click", this.boundDocumentClick);
    }

    select(index) {
        if (index >= 0 && index < this.options.length) {
            this.optionsList.querySelectorAll(".custom-select-option").forEach((option, i) => {
                option.classList.toggle("custom-select-option-selected", i === index);
            });
            if (index !== this.selectedIndex) {
                this.selectedIndex = index;
                this.updateDisplay();
                if (this.onChange) {
                    this.onChange(index);
                }
            } else {
                this.updateDisplay();
            }
            this.close();
        }
    }

    updateDisplay() {
        this.displayTextSpan.textContent = this.options[this.selectedIndex];
    }

    getValue() {
        return this.selectedIndex;
    }

    setValue(index) {
        this.select(index);
    }
}

class ToggleSwitch {
    constructor(container, checked = false, onChange = null) {
        this.container = container;
        this.checked = checked;
        this.onChange = onChange;

        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = "";
        this.container.className = "toggle-container";
        this.switchElement = document.createElement("div");
        this.switchElement.className = "toggle-switch";
        if (this.checked) {
            this.switchElement.classList.add("active");
        }
        this.container.appendChild(this.switchElement);
    }

    bindEvents() {
        this.switchElement.addEventListener("click", (e) => {
            this.toggle();
        });
    }

    toggle() {
        this.checked = !this.checked;
        this.switchElement.classList.toggle("active");
        if (this.onChange) {
            this.onChange(this.checked);
        }
    }

    getValue() {
        return this.checked;
    }

    setValue(checked) {
        this.checked = checked;
        if (checked) {
            this.switchElement.classList.add("active");
        } else {
            this.switchElement.classList.remove("active");
        }
    }
}

class CustomProgressBar {
    constructor(container, initialValue = 0, onChange = null) {
        if (!container || !(container instanceof HTMLElement)) {
            throw new Error("CustomProgressBar: 需要有效的容器DOM元素");
        }
        this.container = container;
        this._value = Math.min(1, Math.max(0, initialValue));
        this.onChange = onChange;
        this.isDragging = false;

        // 事件处理器绑定
        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseUp = this._onMouseUp.bind(this);
        this._boundTouchMove = this._onTouchMove.bind(this);
        this._boundTouchEnd = this._onTouchEnd.bind(this);
        this._boundMouseDown = this._onMouseDown.bind(this);
        this._boundTouchStart = this._onTouchStart.bind(this);

        this._render();
        this._bindEvents();
    }

    _render() {
        this.container.innerHTML = "";

        this.fillElement = document.createElement("div");
        this.fillElement.className = "custom-progress-fill";
        this.container.appendChild(this.fillElement);
        this._updateFillWidth();
    }

    _updateFillWidth() {
        if (this.fillElement) {
            this.fillElement.style.width = `${this._value * 100}%`;
        }
    }

    _calculateValueFromEvent(clientX) {
        const rect = this.container.getBoundingClientRect();
        if (rect.width <= 0) return this._value;
        let relativeX = clientX - rect.left;
        relativeX = Math.min(rect.width, Math.max(0, relativeX));
        return relativeX / rect.width;
    }

    _updateValueFromEvent(clientX) {
        const newValue = this._calculateValueFromEvent(clientX);
        if (Math.abs(newValue - this._value) > 0.0001) {
            this.setValue(newValue);
        }
    }

    _onMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this._updateValueFromEvent(e.clientX);
        window.addEventListener("mousemove", this._boundMouseMove);
        window.addEventListener("mouseup", this._boundMouseUp);
        this.container.style.cursor = "grabbing";
    }

    _onMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this._updateValueFromEvent(e.clientX);
    }

    _onMouseUp() {
        if (!this.isDragging) return;
        this.isDragging = false;
        window.removeEventListener("mousemove", this._boundMouseMove);
        window.removeEventListener("mouseup", this._boundMouseUp);
        this.container.style.cursor = "";
    }

    _onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        this.isDragging = true;
        this._updateValueFromEvent(touch.clientX);
        window.addEventListener("touchmove", this._boundTouchMove, { passive: false });
        window.addEventListener("touchend", this._boundTouchEnd);
        window.addEventListener("touchcancel", this._boundTouchEnd);
    }

    _onTouchMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) this._updateValueFromEvent(touch.clientX);
    }

    _onTouchEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;
        window.removeEventListener("touchmove", this._boundTouchMove);
        window.removeEventListener("touchend", this._boundTouchEnd);
        window.removeEventListener("touchcancel", this._boundTouchEnd);
    }

    _bindEvents() {
        this.container.addEventListener("mousedown", this._boundMouseDown);
        this.container.addEventListener("touchstart", this._boundTouchStart, { passive: false });
    }

    setValue(value, silent = false) {
        let newValue = Math.min(1, Math.max(0, value));
        if (Math.abs(newValue - this._value) < 0.000001) return;
        this._value = newValue;
        this._updateFillWidth();
        if (!silent && this.onChange) {
            this.onChange(this._value);
        }
    }

    getValue() {
        return this._value;
    }
}
