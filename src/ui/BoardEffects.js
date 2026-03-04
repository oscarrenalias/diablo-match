import Phaser from "phaser";

export class BoardEffects {
  constructor(scene, boardRect, depth = 20) {
    this.scene = scene;
    this.boardRect = { ...boardRect };
    this.depth = depth;
    this.nodes = [];
  }

  setBoardRect(boardRect) {
    this.boardRect = { ...boardRect };
  }

  textStyle(color = "#f5e5c4", fontSize = 30) {
    return {
      fontFamily: "Trebuchet MS",
      fontSize: `${fontSize}px`,
      color,
      stroke: "#1a1620",
      strokeThickness: 5,
    };
  }

  showFloatingText(text, x, y, { color = "#f5e5c4", fontSize = 30, duration = 900 } = {}) {
    const node = this.scene.add
      .text(Math.round(x), Math.round(y), text, this.textStyle(color, fontSize))
      .setOrigin(0.5)
      .setDepth(this.depth)
      .setAlpha(0)
      .setScale(0.95);

    this.nodes.push(node);

    this.scene.tweens.add({
      targets: node,
      y: Math.round(y - 40),
      alpha: 1,
      scaleX: 1.08,
      scaleY: 1.08,
      ease: "Sine.easeOut",
      duration: 220,
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: node,
          alpha: 0,
          y: Math.round(node.y - 10),
          ease: "Sine.easeInOut",
          duration: Math.max(250, duration - 220),
          onComplete: () => {
            node.destroy();
            this.nodes = this.nodes.filter((item) => item !== node);
          },
        });
      },
    });
  }

  showCombo(multiplier) {
    if (multiplier <= 1) {
      return;
    }

    this.showFloatingText(`COMBO x${multiplier}`, this.boardRect.cx, this.boardRect.cy, {
      color: "#ffe08a",
      fontSize: 34,
      duration: 1000,
    });
  }

  showDamage(amount, target = "enemy") {
    const x = target === "enemy" ? this.boardRect.right - 70 : this.boardRect.left + 70;
    const y = this.boardRect.cy;

    this.showFloatingText(String(Math.round(amount)), x, y, {
      color: "#ff8f8f",
      fontSize: 30,
      duration: 900,
    });
  }

  showExtraTurn() {
    this.showFloatingText("EXTRA TURN", this.boardRect.cx, this.boardRect.cy - 30, {
      color: "#93f0b5",
      fontSize: 30,
      duration: 900,
    });
  }

  showCrit() {
    this.showFloatingText("CRITICAL", this.boardRect.cx + 30, this.boardRect.cy - 20, {
      color: "#ffbe6b",
      fontSize: 30,
      duration: 900,
    });
  }

  destroy() {
    for (const node of this.nodes) {
      node.destroy();
    }
    this.nodes = [];
  }
}
