export interface VideoEffect {
  id: string;
  name: string;
  type: 'beauty' | 'filter' | 'sticker' | 'text' | 'transition' | 'speed' | 'blur' | 'zoom' | 'shake' | 'glow';
  preview: string;
  apply: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, frame: HTMLVideoElement) => void;
  intensity?: number;
}

export class VideoEffectsProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;
  private effects: VideoEffect[] = [];
  private animationFrame: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  // Beauty filter - skin smoothing and brightness
  applyBeautyFilter(frame: HTMLVideoElement, intensity: number = 0.5) {
    this.ctx.filter = `blur(${intensity * 2}px) brightness(${1 + intensity * 0.3}) contrast(${1 - intensity * 0.2})`;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'none';
  }

  // Color filters (LUT style)
  applyColorFilter(frame: HTMLVideoElement, filterType: string) {
    const filters = {
      vintage: 'sepia(0.5) contrast(1.2) brightness(0.9)',
      cool: 'hue-rotate(180deg) saturate(1.2)',
      warm: 'hue-rotate(-30deg) saturate(1.3) brightness(1.1)',
      blackwhite: 'grayscale(1) contrast(1.5)',
      retro: 'sepia(0.8) contrast(1.4) brightness(1.2)',
      cinematic: 'contrast(1.3) brightness(0.9) saturate(1.2)',
    };

    this.ctx.filter = filters[filterType as keyof typeof filters] || 'none';
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'none';
  }

  // Background blur effect
  applyBackgroundBlur(frame: HTMLVideoElement, intensity: number = 0.7) {
    // First draw blurred background
    this.ctx.filter = `blur(${intensity * 20}px)`;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    
    // Then draw sharp foreground (simplified - in real app would use segmentation)
    this.ctx.filter = 'none';
    this.ctx.globalAlpha = 0.9;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalAlpha = 1;
  }

  // Speed control
  applySpeedEffect(frame: HTMLVideoElement, speed: number) {
    // Speed is handled at the MediaRecorder level
    // This applies visual effects to indicate speed
    if (speed > 1) {
      this.ctx.filter = 'contrast(1.2) saturate(1.1)';
    } else if (speed < 1) {
      this.ctx.filter = 'contrast(0.8) brightness(0.9)';
    }
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'none';
  }

  // Add text overlay
  addTextOverlay(text: string, position: { x: number; y: number }, style: any = {}) {
    const {
      font = '24px Arial',
      color = 'white',
      stroke = 'black',
      strokeWidth = 2,
      align = 'center'
    } = style;

    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.strokeText(text, position.x, position.y);
    }
    
    this.ctx.fillText(text, position.x, position.y);
  }

  // Add sticker/emoji
  addSticker(emoji: string, position: { x: number; y: number }, size: number = 50) {
    this.ctx.font = `${size}px Arial`;
    this.ctx.fillText(emoji, position.x, position.y);
  }

  // Zoom effect
  applyZoom(frame: HTMLVideoElement, zoomLevel: number = 1.2) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const width = this.canvas.width / zoomLevel;
    const height = this.canvas.height / zoomLevel;
    const startX = centerX - width / 2;
    const startY = centerY - height / 2;

    this.ctx.drawImage(frame, startX, startY, width, height, 0, 0, this.canvas.width, this.canvas.height);
  }

  // Shake effect
  applyShake(frame: HTMLVideoElement, intensity: number = 10) {
    const shakeX = (Math.random() - 0.5) * intensity;
    const shakeY = (Math.random() - 0.5) * intensity;
    
    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  // Glow effect
  applyGlow(frame: HTMLVideoElement, intensity: number = 0.5) {
    this.ctx.shadowColor = '#ffffff';
    this.ctx.shadowBlur = intensity * 20;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.shadowBlur = 0;
  }

  // Process frame with multiple effects
  processFrame(frame: HTMLVideoElement, activeEffects: any[]) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    activeEffects.forEach(effect => {
      switch (effect.type) {
        case 'beauty':
          this.applyBeautyFilter(frame, effect.intensity);
          break;
        case 'filter':
          this.applyColorFilter(frame, effect.filterType);
          break;
        case 'blur':
          this.applyBackgroundBlur(frame, effect.intensity);
          break;
        case 'speed':
          this.applySpeedEffect(frame, effect.speed);
          break;
        case 'zoom':
          this.applyZoom(frame, effect.zoomLevel);
          break;
        case 'shake':
          this.applyShake(frame, effect.intensity);
          break;
        case 'glow':
          this.applyGlow(frame, effect.intensity);
          break;
        case 'text':
          this.addTextOverlay(effect.text, effect.position, effect.style);
          break;
        case 'sticker':
          this.addSticker(effect.emoji, effect.position, effect.size);
          break;
      }
    });
  }

  // Get available effects
  getAvailableEffects(): VideoEffect[] {
    return [
      {
        id: 'beauty-natural',
        name: 'Natural Beauty',
        type: 'beauty',
        preview: '✨',
        apply: (canvas, ctx, frame) => this.applyBeautyFilter(frame, 0.3)
      },
      {
        id: 'beauty-glam',
        name: 'Glam Beauty',
        type: 'beauty',
        preview: '💄',
        apply: (canvas, ctx, frame) => this.applyBeautyFilter(frame, 0.7)
      },
      {
        id: 'filter-vintage',
        name: 'Vintage',
        type: 'filter',
        preview: '📷',
        apply: (canvas, ctx, frame) => this.applyColorFilter(frame, 'vintage')
      },
      {
        id: 'filter-cool',
        name: 'Cool',
        type: 'filter',
        preview: '❄️',
        apply: (canvas, ctx, frame) => this.applyColorFilter(frame, 'cool')
      },
      {
        id: 'filter-warm',
        name: 'Warm',
        type: 'filter',
        preview: '🔥',
        apply: (canvas, ctx, frame) => this.applyColorFilter(frame, 'warm')
      },
      {
        id: 'filter-cinematic',
        name: 'Cinematic',
        type: 'filter',
        preview: '🎬',
        apply: (canvas, ctx, frame) => this.applyColorFilter(frame, 'cinematic')
      },
      {
        id: 'blur-background',
        name: 'Blur Background',
        type: 'blur',
        preview: '🌫️',
        apply: (canvas, ctx, frame) => this.applyBackgroundBlur(frame, 0.7)
      },
      {
        id: 'zoom-in',
        name: 'Zoom In',
        type: 'zoom',
        preview: '🔍',
        apply: (canvas, ctx, frame) => this.applyZoom(frame, 1.3)
      },
      {
        id: 'shake',
        name: 'Shake',
        type: 'shake',
        preview: '📳',
        apply: (canvas, ctx, frame) => this.applyShake(frame, 8)
      },
      {
        id: 'glow',
        name: 'Glow',
        type: 'glow',
        preview: '✨',
        apply: (canvas, ctx, frame) => this.applyGlow(frame, 0.6)
      }
    ];
  }

  // Start processing
  start(videoElement: HTMLVideoElement, onFrame: (canvas: HTMLCanvasElement) => void) {
    const processFrame = () => {
      if (videoElement.readyState === 4) {
        this.processFrame(videoElement, this.effects);
        onFrame(this.canvas);
      }
      this.animationFrame = requestAnimationFrame(processFrame);
    };
    processFrame();
  }

  // Stop processing
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Add effect
  addEffect(effect: VideoEffect) {
    this.effects.push(effect);
  }

  // Remove effect
  removeEffect(effectId: string) {
    this.effects = this.effects.filter(e => e.id !== effectId);
  }

  // Clear all effects
  clearEffects() {
    this.effects = [];
  }
}