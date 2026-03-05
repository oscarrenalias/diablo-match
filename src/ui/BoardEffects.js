import Phaser from "phaser";

const DEFAULT_POOL_SIZE = 24;
const MAX_LANES = 4;

export class BoardEffects {
  constructor(scene, boardRect, depth = 20) {
    this.scene = scene;
    this.boardRect = { ...boardRect };
    this.depth = depth;

    this.pool = [];
    this.active = new Set();
    this.activeLanes = {
      hero: 0,
      enemy: 0,
      center: 0,
    };

    this.bootstrapPool();
  }

  bootstrapPool() {
    for (let i = 0; i < DEFAULT_POOL_SIZE; i += 1) {
      const node = this.scene.add
        .text(0, 0, "", this.textStyle())
        .setOrigin(0.5)
        .setDepth(this.depth)
        .setVisible(false)
        .setActive(false);

      this.pool.push(node);
    }
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

  acquireNode() {
    const reusable = this.pool.find((node) => !node.active);
    if (reusable) {
      return reusable;
    }

    const node = this.scene.add
      .text(0, 0, "", this.textStyle())
      .setOrigin(0.5)
      .setDepth(this.depth)
      .setVisible(false)
      .setActive(false);
    this.pool.push(node);
    return node;
  }

  releaseNode(node) {
    node.setVisible(false).setActive(false);
    node.setAlpha(1).setScale(1);
    this.active.delete(node);
  }

  laneOffset(targetLane) {
    const lane = this.activeLanes[targetLane] % MAX_LANES;
    this.activeLanes[targetLane] += 1;
    return (lane - (MAX_LANES - 1) / 2) * 18;
  }

  showFloatingText(text, x, y, { color = "#f5e5c4", fontSize = 30, duration = 900, lane = "center" } = {}) {
    const node = this.acquireNode();
    const yOffset = this.laneOffset(lane);

    node
      .setStyle(this.textStyle(color, fontSize))
      .setText(text)
      .setPosition(Math.round(x), Math.round(y + yOffset))
      .setVisible(true)
      .setActive(true)
      .setDepth(this.depth)
      .setAlpha(0)
      .setScale(0.94);

    this.active.add(node);

    this.scene.tweens.killTweensOf(node);

    this.scene.tweens.add({
      targets: node,
      y: Math.round(node.y - 34),
      alpha: 1,
      scaleX: 1.04,
      scaleY: 1.04,
      ease: "Sine.easeOut",
      duration: 220,
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: node,
          alpha: 0,
          y: Math.round(node.y - 12),
          ease: "Sine.easeInOut",
          duration: Math.max(220, duration - 220),
          onComplete: () => this.releaseNode(node),
        });
      },
    });
  }

  sideAnchor(target = "enemy") {
    if (target === "hero") {
      return { x: this.boardRect.x + 74, y: this.boardRect.cy, lane: "hero" };
    }

    if (target === "center") {
      return { x: this.boardRect.cx, y: this.boardRect.cy, lane: "center" };
    }

    return { x: this.boardRect.right - 74, y: this.boardRect.cy, lane: "enemy" };
  }

  showCombo(multiplier) {
    if (multiplier <= 1) {
      return;
    }

    const anchor = this.sideAnchor("center");
    this.showFloatingText(`COMBO x${multiplier}`, anchor.x, anchor.y, {
      color: "#ffe08a",
      fontSize: 34,
      duration: 1000,
      lane: anchor.lane,
    });
  }

  showDamage(amount, target = "enemy") {
    const anchor = this.sideAnchor(target === "hero" ? "hero" : "enemy");
    this.showFloatingText(`${Math.round(amount)} Damage`, anchor.x, anchor.y, {
      color: "#ff8f8f",
      fontSize: 30,
      duration: 1300,
      lane: anchor.lane,
    });
  }

  showManaGain(amount, target = "hero") {
    const anchor = this.sideAnchor(target);
    this.showFloatingText(`+${Math.round(amount)} mana`, anchor.x, anchor.y - 16, {
      color: "#91b7ff",
      fontSize: 24,
      duration: 1300,
      lane: anchor.lane,
    });
  }

  showArmorGain(amount, target = "hero") {
    const anchor = this.sideAnchor(target);
    this.showFloatingText(`+${Math.round(amount)} armor`, anchor.x, anchor.y - 16, {
      color: "#d6d8dd",
      fontSize: 24,
      duration: 1300,
      lane: anchor.lane,
    });
  }

  showGoldGain(amount, target = "hero") {
    const anchor = this.sideAnchor(target);
    this.showFloatingText(`+${Math.round(amount)} gold`, anchor.x, anchor.y - 16, {
      color: "#ffd580",
      fontSize: 24,
      duration: 1300,
      lane: anchor.lane,
    });
  }

  showExtraTurn() {
    const anchor = this.sideAnchor("center");
    this.showFloatingText("EXTRA TURN", anchor.x, anchor.y - 30, {
      color: "#93f0b5",
      fontSize: 30,
      duration: 900,
      lane: anchor.lane,
    });
  }

  showCrit() {
    const anchor = this.sideAnchor("center");
    this.showFloatingText("CRITICAL", anchor.x + 30, anchor.y - 20, {
      color: "#ffbe6b",
      fontSize: 30,
      duration: 900,
      lane: anchor.lane,
    });
  }

  destroy() {
    for (const node of this.pool) {
      this.scene.tweens.killTweensOf(node);
      node.destroy();
    }

    this.pool = [];
    this.active.clear();
  }
}
