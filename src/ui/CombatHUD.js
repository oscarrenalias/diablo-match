import Phaser from "phaser";
import { DEFAULT_HERO_PORTRAIT_DURATION_MS, HERO_PORTRAIT_STATE_DURATIONS_MS } from "./hudConfig.js";

const LOG_MAX_LINES = 4;

const ENEMY_PORTRAIT_FOLDERS = {
  skeleton_warrior: "skeleton",
  skeleton_archer: "skeleton_archer",
  ghost: "apparition",
  necromancer: "necromancer",
  dark_wizard: "dark_wizard",
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function capWord(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export class CombatHUD {
  constructor(scene, { boardRect, heroClass = "warrior", enemyId = "skeleton_warrior", depth = 30 } = {}) {
    this.scene = scene;
    this.depth = depth;
    this.boardRect = { ...boardRect };

    this.heroFolder = this.resolveHeroFolder(heroClass);
    this.enemyFolder = this.resolveEnemyFolder(enemyId);

    this.heroStateLocked = false;
    this.heroOverrideToken = 0;
    this.heroOverrideUntil = 0;
    this.heroBaseState = "idle";
    this.currentHeroState = "idle";
    this.currentEnemyState = "idle";

    this.activeTurnOwner = "player";
    this.phaseBannerVisible = false;
    this.externalPortraitLayoutEnabled = false;

    this.logLines = [];

    this.primarySpellHandler = null;
    this.spell2Handler = null;
    this.spell3Handler = null;

    this.createNodes();
    this.layout(this.viewportRect());
    this.applyHeroState("idle");
    this.applyEnemyState("idle");
    this.setTurnOwner("player");
  }

  viewportRect() {
    return {
      width: this.scene.scale.width,
      height: this.scene.scale.height,
    };
  }

  setBoardRect(boardRect) {
    this.boardRect = { ...boardRect };
  }

  createFrameRect(width, height, fill = 0x1d1b20, stroke = 0x69605a) {
    return this.scene.add
      .rectangle(0, 0, width, height, fill, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, stroke)
      .setDepth(this.depth);
  }

  createNodes() {
    this.boardFrame = this.createFrameRect(100, 100, 0x111018, 0x4f4740).setDepth(this.depth - 1);
    this.boardFrame.setFillStyle(0x000000, 0);

    this.turnStrip = this.createFrameRect(300, 42, 0x171720, 0x595461);
    this.turnLabel = this.scene.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#dfddd7",
      })
      .setDepth(this.depth + 1)
      .setOrigin(0.5);

    this.phaseBannerStrip = this.createFrameRect(240, 34, 0x171720, 0x4f5e79).setDepth(this.depth + 1);
    this.phaseBannerLabel = this.scene.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "16px",
        color: "#dce7ff",
      })
      .setDepth(this.depth + 2)
      .setOrigin(0.5);

    this.heroPortraitGlow = this.scene.add.circle(0, 0, 100, 0xffb36e, 0.08).setDepth(this.depth - 2);
    this.enemyPortraitGlow = this.scene.add.circle(0, 0, 100, 0x76d995, 0.08).setDepth(this.depth - 2);

    this.heroPortraitFrame = this.createFrameRect(220, 220, 0x1f1d24, 0x6b6660);
    this.enemyPortraitFrame = this.createFrameRect(220, 220, 0x1f1d24, 0x6b6660);

    this.heroPortrait = this.scene.add.image(0, 0, "ui-portraits-atlas").setDepth(this.depth + 1);
    this.enemyPortrait = this.scene.add.image(0, 0, "ui-portraits-atlas").setDepth(this.depth + 1);

    this.heroName = this.scene.add
      .text(0, 0, "HERO", {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#efe7db",
      })
      .setDepth(this.depth + 1)
      .setOrigin(0.5, 0);

    this.enemyName = this.scene.add
      .text(0, 0, "ENEMY", {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#efe7db",
      })
      .setDepth(this.depth + 1)
      .setOrigin(0.5, 0);

    this.heroBars = this.createBarGroup();
    this.enemyBars = this.createBarGroup();

    this.logPanel = this.createFrameRect(330, 120, 0x191a23, 0x50566f);
    this.logTitle = this.scene.add
      .text(0, 0, "Combat Log", {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#d9dfe9",
      })
      .setDepth(this.depth + 1)
      .setOrigin(0, 0);
    this.logText = this.scene.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "13px",
        color: "#bcc4d3",
        lineSpacing: 2,
      })
      .setDepth(this.depth + 1)
      .setOrigin(0, 0);
    this.logPanel.setVisible(false);
    this.logTitle.setVisible(false);
    this.logText.setVisible(false);

    this.spellPanel = this.createFrameRect(420, 92, 0x181922, 0x575d74);
    this.spellButtons = [0, 1, 2].map((index) => this.createSpellButton(index));
  }

  createBarGroup() {
    return {
      hp: this.createSingleBar("HP", 0xa53f3f, "#f0d7d7"),
      mana: this.createSingleBar("MANA", 0x3a66b9, "#d9e6ff"),
      armor: this.createSingleBar("ARMOR", 0x7d848d, "#eceef0"),
    };
  }

  createSingleBar(label, fillColor, textColor) {
    const width = 210;
    const height = 18;

    const container = this.scene.add.container(0, 0).setDepth(this.depth + 1);
    const frame = this.scene.add
      .rectangle(0, 0, width, height, 0x111318, 1)
      .setOrigin(0)
      .setStrokeStyle(2, 0x50535e);
    const fill = this.scene.add.rectangle(2, 2, width - 4, height - 4, fillColor, 1).setOrigin(0);
    const text = this.scene.add
      .text(width / 2, height / 2, `${label} 0/0`, {
        fontFamily: "Trebuchet MS",
        fontSize: "11px",
        color: textColor,
      })
      .setOrigin(0.5);

    container.add([frame, fill, text]);
    return { container, fill, text, width, height, label };
  }

  createSpellButton(index) {
    const btn = this.scene.add.container(0, 0).setDepth(this.depth + 2);
    const width = 110;
    const height = 64;
    const box = this.scene.add
      .rectangle(0, 0, width, height, 0x262833, 1)
      .setOrigin(0)
      .setStrokeStyle(2, 0x676c81)
      .setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(width / 2, height / 2, `${index + 1}`, {
        fontFamily: "Trebuchet MS",
        fontSize: "24px",
        color: "#d9dce6",
      })
      .setOrigin(0.5);

    btn.add([box, label]);

    box.on("pointerup", () => {
      if (index === 0 && this.primarySpellHandler) {
        this.primarySpellHandler();
      } else if (index === 1 && this.spell2Handler) {
        this.spell2Handler();
      } else if (index === 2 && this.spell3Handler) {
        this.spell3Handler();
      }
    });

    if (index > 0) {
      box.setFillStyle(0x1e2028, 1);
      box.setStrokeStyle(2, 0x474a57);
      label.setText("-");
      label.setAlpha(0.55);
    }

    return { btn, box, label, width, height };
  }

  resolveHeroFolder(heroClass) {
    const atlas = this.scene.textures.get("ui-portraits-atlas");
    if (atlas && atlas.has(`portraits/${heroClass}/idle`)) {
      return heroClass;
    }
    return "warrior";
  }

  resolveEnemyFolder(enemyIdOrFolder) {
    const mapped = ENEMY_PORTRAIT_FOLDERS[enemyIdOrFolder] ?? enemyIdOrFolder;
    const atlas = this.scene.textures.get("ui-portraits-atlas");

    if (atlas && atlas.has(`portraits/${mapped}/idle`)) {
      return mapped;
    }

    if (atlas && atlas.has("portraits/skeleton/idle")) {
      return "skeleton";
    }

    return "warrior";
  }

  setSpellButtons({ onCastPrimary, onSpell2, onSpell3 } = {}) {
    this.primarySpellHandler = onCastPrimary ?? null;
    this.spell2Handler = onSpell2 ?? null;
    this.spell3Handler = onSpell3 ?? null;
  }

  setExternalPortraitLayoutEnabled(enabled) {
    this.externalPortraitLayoutEnabled = Boolean(enabled);
  }

  getPortraitNodes() {
    return {
      heroPortrait: this.heroPortrait,
      enemyPortrait: this.enemyPortrait,
    };
  }

  setLegacyPortraitChromeVisible(visible) {
    const value = Boolean(visible);
    const nodes = [
      this.heroPortraitGlow,
      this.enemyPortraitGlow,
      this.heroPortraitFrame,
      this.enemyPortraitFrame,
      this.heroName,
      this.enemyName,
    ];

    for (const node of nodes) {
      node.setVisible(value);
    }
  }

  setTurnPhaseLabel(text) {
    this.turnLabel.setText(text);
  }

  setPhaseBanner(text, visible = true) {
    this.phaseBannerVisible = visible;
    this.phaseBannerLabel.setText(text ?? "");
    this.phaseBannerStrip.setVisible(visible);
    this.phaseBannerLabel.setVisible(visible);
  }

  setTurnOwner(owner) {
    this.activeTurnOwner = owner;

    const isPlayer = owner === "player";

    this.scene.tweens.killTweensOf(this.heroPortraitGlow);
    this.scene.tweens.killTweensOf(this.enemyPortraitGlow);

    if (isPlayer) {
      this.heroPortraitFrame.setStrokeStyle(3, 0xe6ad69);
      this.enemyPortraitFrame.setStrokeStyle(2, 0x474a57);
      this.heroPortrait.setAlpha(1);
      this.enemyPortrait.setAlpha(0.65);
      this.heroPortraitGlow.setAlpha(0.2);
      this.enemyPortraitGlow.setAlpha(0.04);

      this.scene.tweens.add({
        targets: this.heroPortraitGlow,
        alpha: { from: 0.14, to: 0.24 },
        duration: 580,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.enemyPortraitFrame.setStrokeStyle(3, 0x8fdcac);
      this.heroPortraitFrame.setStrokeStyle(2, 0x474a57);
      this.enemyPortrait.setAlpha(1);
      this.heroPortrait.setAlpha(0.65);
      this.enemyPortraitGlow.setAlpha(0.2);
      this.heroPortraitGlow.setAlpha(0.04);

      this.scene.tweens.add({
        targets: this.enemyPortraitGlow,
        alpha: { from: 0.14, to: 0.24 },
        duration: 580,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  pushCombatLog(line) {
    this.logLines.push(line);
    if (this.logLines.length > LOG_MAX_LINES) {
      this.logLines = this.logLines.slice(this.logLines.length - LOG_MAX_LINES);
    }
    this.logText.setText(this.logLines.join("\n"));
  }

  clearCombatLog() {
    this.logLines = [];
    this.logText.setText("");
  }

  applyHeroState(state) {
    const frame = `portraits/${this.heroFolder}/${state}`;
    const atlas = this.scene.textures.get("ui-portraits-atlas");
    const fallback = `portraits/${this.heroFolder}/idle`;
    const sharedDeadFallback = "portraits/warrior/dead";
    if (atlas?.has(frame)) {
      this.heroPortrait.setFrame(frame);
      this.currentHeroState = state;
    } else if (state === "dead" && atlas?.has(sharedDeadFallback)) {
      this.heroPortrait.setFrame(sharedDeadFallback);
      this.currentHeroState = "dead";
    } else if (atlas?.has(fallback)) {
      this.heroPortrait.setFrame(fallback);
      this.currentHeroState = "idle";
    }
  }

  applyEnemyState(state = "idle") {
    const frame = `portraits/${this.enemyFolder}/${state}`;
    const fallback = `portraits/${this.enemyFolder}/idle`;
    const atlas = this.scene.textures.get("ui-portraits-atlas");

    if (atlas?.has(frame)) {
      this.enemyPortrait.setFrame(frame);
      this.currentEnemyState = state;
    } else if (atlas?.has(fallback)) {
      this.enemyPortrait.setFrame(fallback);
      this.currentEnemyState = "idle";
    }
  }

  setEnemyPortrait(enemyIdOrFolder) {
    this.enemyFolder = this.resolveEnemyFolder(enemyIdOrFolder);
    this.applyEnemyState("idle");
    this.enemyName.setText(capWord(this.enemyFolder.replaceAll("_", " ")));
  }

  setHeroState(eventName) {
    if (this.heroStateLocked && eventName !== "victory") {
      return;
    }

    if (eventName === "victory") {
      this.heroStateLocked = true;
      this.heroOverrideUntil = Number.POSITIVE_INFINITY;
      this.applyHeroState("victory");
      return;
    }

    if (eventName === "lowhp") {
      this.heroBaseState = "lowhp";
      this.applyHeroState("lowhp");
      return;
    }

    if (eventName === "idle") {
      this.heroBaseState = "idle";
      this.applyHeroState("idle");
      return;
    }

    const token = Date.now();
    const durationMs = HERO_PORTRAIT_STATE_DURATIONS_MS[eventName] ?? DEFAULT_HERO_PORTRAIT_DURATION_MS;
    this.heroOverrideToken = token;
    this.heroOverrideUntil = this.scene.time.now + durationMs;
    this.applyHeroState(eventName);

    this.scene.time.delayedCall(durationMs, () => {
      if (this.heroOverrideToken !== token || this.heroStateLocked) {
        return;
      }
      this.heroOverrideUntil = 0;
      this.applyHeroState(this.heroBaseState);
    });
  }

  resetHeroForEncounter() {
    this.heroStateLocked = false;
    this.heroOverrideToken = 0;
    this.heroOverrideUntil = 0;
    this.heroBaseState = "idle";
    this.applyHeroState("idle");
  }

  updateBar(bar, current, max) {
    const safeMax = Math.max(1, max);
    const ratio = clamp01(current / safeMax);
    const width = Math.round((bar.width - 4) * ratio);
    bar.fill.width = width;
    bar.text.setText(`${bar.label} ${Math.round(current)}/${Math.round(safeMax)}`);
  }

  updateVitals({ hero, enemy }) {
    this.updateBar(this.heroBars.hp, hero.hp, hero.maxHp);
    this.updateBar(this.heroBars.mana, hero.mana, Math.max(30, hero.maxMana ?? hero.mana, 1));
    this.updateBar(this.heroBars.armor, hero.armor, Math.max(20, hero.armor, 1));

    this.updateBar(this.enemyBars.hp, enemy.hp, enemy.maxHp);
    this.updateBar(this.enemyBars.mana, enemy.mana ?? 0, Math.max(10, enemy.maxMana ?? enemy.mana ?? 0, 1));
    this.updateBar(this.enemyBars.armor, enemy.armor ?? 0, Math.max(20, enemy.armor ?? 0, 1));

    if (hero.hp <= 0) {
      this.heroStateLocked = true;
      this.heroOverrideUntil = Number.POSITIVE_INFINITY;
      if (this.currentHeroState !== "dead") {
        this.applyHeroState("dead");
      }
    } else {
      const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
      this.heroBaseState = hpRatio < 0.25 ? "lowhp" : "idle";

      const hasTimedOverride = this.scene.time.now < this.heroOverrideUntil;
      if (!this.heroStateLocked && !hasTimedOverride && this.currentHeroState !== this.heroBaseState) {
        this.applyHeroState(this.heroBaseState);
      }
    }

    const enemyState = enemy.hp <= 0 ? "dead" : "idle";
    if (this.currentEnemyState !== enemyState) {
      this.applyEnemyState(enemyState);
    }

    this.heroName.setText(capWord((hero.name ?? "hero").toLowerCase()));
    this.enemyName.setText(capWord((enemy.name ?? "enemy").toLowerCase()));
  }

  layout(viewportRect, boardRect = this.boardRect) {
    this.boardRect = { ...boardRect };

    const isMobile = viewportRect.width < 900;
    const sideGap = isMobile ? 0 : 14;
    const portraitSize = isMobile
      ? Math.round(Phaser.Math.Clamp(viewportRect.width * 0.24, 140, 192))
      : Math.round(Phaser.Math.Clamp(boardRect.height * 0.62, 260, 384));

    this.boardFrame.setPosition(boardRect.x - 10, boardRect.y - 10);
    this.boardFrame.setSize(boardRect.width + 20, boardRect.height + 20);

    this.turnStrip.setSize(300, 42);
    const turnStripY = Math.max(14, Math.round(boardRect.y - 52));
    this.turnStrip.setPosition(Math.round((viewportRect.width - 300) / 2), turnStripY);
    this.turnLabel.setPosition(this.turnStrip.x + 150, this.turnStrip.y + 21);

    this.phaseBannerStrip.setSize(240, 34);
    this.phaseBannerStrip.setPosition(Math.round((viewportRect.width - 240) / 2), this.turnStrip.y + 46);
    this.phaseBannerLabel.setPosition(this.phaseBannerStrip.x + 120, this.phaseBannerStrip.y + 17);

    let heroX;
    let heroY;
    let enemyX;
    let enemyY;

    if (isMobile) {
      heroX = 16;
      enemyX = viewportRect.width - portraitSize - 16;
      heroY = 66;
      enemyY = 66;
    } else {
      heroX = boardRect.x - portraitSize - sideGap;
      enemyX = boardRect.right + sideGap;
      heroY = boardRect.y;
      enemyY = boardRect.y;
    }

    if (!this.externalPortraitLayoutEnabled) {
      this.heroPortraitFrame.setPosition(heroX, heroY);
      this.heroPortraitFrame.setSize(portraitSize, portraitSize);
      this.enemyPortraitFrame.setPosition(enemyX, enemyY);
      this.enemyPortraitFrame.setSize(portraitSize, portraitSize);

      this.heroPortrait.setPosition(heroX + portraitSize / 2, heroY + portraitSize / 2);
      this.enemyPortrait.setPosition(enemyX + portraitSize / 2, enemyY + portraitSize / 2);
      this.heroPortrait.setDisplaySize(portraitSize - 12, portraitSize - 12);
      this.enemyPortrait.setDisplaySize(portraitSize - 12, portraitSize - 12);

      this.heroPortraitGlow.setPosition(heroX + portraitSize / 2 + 24, heroY + portraitSize / 2);
      this.heroPortraitGlow.setRadius(Math.round(portraitSize * 0.5));
      this.enemyPortraitGlow.setPosition(enemyX + portraitSize / 2 - 24, enemyY + portraitSize / 2);
      this.enemyPortraitGlow.setRadius(Math.round(portraitSize * 0.5));

      this.heroName.setPosition(heroX + portraitSize / 2, heroY + portraitSize + 6);
      this.enemyName.setPosition(enemyX + portraitSize / 2, enemyY + portraitSize + 6);
    }

    const heroBarsX = heroX;
    const enemyBarsX = enemyX;
    const barsYStart = heroY + portraitSize + 26;

    const barGap = 22;
    const heroBarList = [this.heroBars.hp, this.heroBars.mana, this.heroBars.armor];
    const enemyBarList = [this.enemyBars.hp, this.enemyBars.mana, this.enemyBars.armor];

    for (let i = 0; i < heroBarList.length; i += 1) {
      heroBarList[i].container.setPosition(heroBarsX, barsYStart + i * barGap);
      enemyBarList[i].container.setPosition(enemyBarsX, barsYStart + i * barGap);
    }

    this.spellPanel.setPosition(Math.round((viewportRect.width - 420) / 2), Math.round(boardRect.bottom + 18));
    this.spellPanel.setSize(420, 92);

    for (let i = 0; i < this.spellButtons.length; i += 1) {
      const btn = this.spellButtons[i];
      btn.btn.setPosition(this.spellPanel.x + 12 + i * (btn.width + 10), this.spellPanel.y + 14);
    }

    this.logPanel.setPosition(Math.max(16, this.spellPanel.x - 350), Math.max(58, this.spellPanel.y - 132));
    this.logPanel.setSize(330, 120);
    this.logTitle.setPosition(this.logPanel.x + 10, this.logPanel.y + 8);
    this.logText.setPosition(this.logPanel.x + 10, this.logPanel.y + 30);

    this.phaseBannerStrip.setVisible(this.phaseBannerVisible);
    this.phaseBannerLabel.setVisible(this.phaseBannerVisible);
  }

  setVisible(visible) {
    const nodes = [
      this.boardFrame,
      this.turnStrip,
      this.turnLabel,
      this.phaseBannerStrip,
      this.phaseBannerLabel,
      this.heroPortraitGlow,
      this.enemyPortraitGlow,
      this.heroPortraitFrame,
      this.enemyPortraitFrame,
      this.heroPortrait,
      this.enemyPortrait,
      this.heroName,
      this.enemyName,
      this.spellPanel,
      ...Object.values(this.heroBars).map((bar) => bar.container),
      ...Object.values(this.enemyBars).map((bar) => bar.container),
      ...this.spellButtons.map((btn) => btn.btn),
    ];

    for (const node of nodes) {
      node.setVisible(visible);
    }

    this.logPanel.setVisible(false);
    this.logTitle.setVisible(false);
    this.logText.setVisible(false);
  }

  destroy() {
    this.setVisible(false);

    const nodes = [
      this.boardFrame,
      this.turnStrip,
      this.turnLabel,
      this.phaseBannerStrip,
      this.phaseBannerLabel,
      this.heroPortraitGlow,
      this.enemyPortraitGlow,
      this.heroPortraitFrame,
      this.enemyPortraitFrame,
      this.heroPortrait,
      this.enemyPortrait,
      this.heroName,
      this.enemyName,
      this.logPanel,
      this.logTitle,
      this.logText,
      this.spellPanel,
      ...Object.values(this.heroBars).map((bar) => bar.container),
      ...Object.values(this.enemyBars).map((bar) => bar.container),
      ...this.spellButtons.map((btn) => btn.btn),
    ];

    this.scene.tweens.killTweensOf(this.heroPortraitGlow);
    this.scene.tweens.killTweensOf(this.enemyPortraitGlow);

    for (const node of nodes) {
      node.destroy();
    }
  }
}
