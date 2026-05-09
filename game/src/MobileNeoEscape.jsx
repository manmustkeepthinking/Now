import React, { useEffect, useRef, useState } from 'react';

const WORLD_W = 3200, WORLD_H = 2000;
const JOY_RADIUS = 60;

const OBSTACLES = [
  { x: 1500, y: 1000, w: 200, h: 200 }, { x: 500, y: 500, w: 100, h: 100 },
  { x: 2500, y: 1500, w: 150, h: 150 }, { x: 800, y: 1500, w: 300, h: 40 }
];

const ENEMY_SPAWNS = Array.from({ length: 25 }, () => ({
  x: Math.random() * WORLD_W,
  y: Math.random() * WORLD_H,
  type: Math.random() > 0.8 ? 'sniper' : 'agent'
}));

export default function MobileNeoEscape() {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ hp: 100, meter: 100, gameState: 'menu' });

  const stateRef = useRef({
    player: { x: 1600, y: 1000, hp: 100, angle: 0 },
    camera: { x: 0, y: 0 },
    bullets: [],
    enemies: ENEMY_SPAWNS.map((s, i) => ({ ...s, id: i, hp: 3, shootCooldown: 2 })),
    moveStick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, kX: 0, kY: 0 },
    aimStick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, kX: 0, kY: 0, angle: 0 },
    gameState: 'menu',
    bulletTime: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let logicalW = window.innerWidth;
    let logicalH = window.innerHeight;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      logicalW = window.innerWidth;
      logicalH = window.innerHeight;
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleTouch = (e) => {
      e.preventDefault();
      const s = stateRef.current;
      const rect = canvas.getBoundingClientRect();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;

        if (e.type === 'touchstart') {
          if (tx < logicalW / 2 && !s.moveStick.active) {
            s.moveStick = { active: true, id: t.identifier, baseX: tx, baseY: ty, kX: tx, kY: ty, dx: 0, dy: 0 };
          } else if (tx >= logicalW / 2 && !s.aimStick.active) {
            if (tx > logicalW - 100 && ty < 300) continue;
            s.aimStick = { active: true, id: t.identifier, baseX: tx, baseY: ty, kX: tx, kY: ty, dx: 0, dy: 0, angle: 0 };
          }
        }

        if (e.type === 'touchmove') {
          if (t.identifier === s.moveStick.id) {
            const dist = Math.hypot(tx - s.moveStick.baseX, ty - s.moveStick.baseY);
            const angle = Math.atan2(ty - s.moveStick.baseY, tx - s.moveStick.baseX);
            const moveDist = Math.min(dist, JOY_RADIUS);
            s.moveStick.kX = s.moveStick.baseX + Math.cos(angle) * moveDist;
            s.moveStick.kY = s.moveStick.baseY + Math.sin(angle) * moveDist;
            s.moveStick.dx = (Math.cos(angle) * moveDist) / JOY_RADIUS;
            s.moveStick.dy = (Math.sin(angle) * moveDist) / JOY_RADIUS;
          }
          if (t.identifier === s.aimStick.id) {
            const dist = Math.hypot(tx - s.aimStick.baseX, ty - s.aimStick.baseY);
            const angle = Math.atan2(ty - s.aimStick.baseY, tx - s.aimStick.baseX);
            const moveDist = Math.min(dist, JOY_RADIUS);
            s.aimStick.kX = s.aimStick.baseX + Math.cos(angle) * moveDist;
            s.aimStick.kY = s.aimStick.baseY + Math.sin(angle) * moveDist;
            s.aimStick.angle = angle;
            s.aimStick.dx = (Math.cos(angle) * moveDist) / JOY_RADIUS;
            s.aimStick.dy = (Math.sin(angle) * moveDist) / JOY_RADIUS;
          }
        }

        if (e.type === 'touchend' || e.type === 'touchcancel') {
          if (t.identifier === s.moveStick.id) {
            s.moveStick.active = false;
            s.moveStick.dx = 0;
            s.moveStick.dy = 0;
          }
          if (t.identifier === s.aimStick.id) {
            s.aimStick.active = false;
            s.aimStick.dx = 0;
            s.aimStick.dy = 0;
          }
        }
      }
    };

    const drawJoy = (j) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(j.baseX, j.baseY, JOY_RADIUS, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(j.kX, j.kY, 20, 0, Math.PI * 2); ctx.fill();
    };

    const drawEnemy = (e) => {
      ctx.fillStyle = e.type === 'sniper' ? '#f44' : '#f80';
      ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI * 2); ctx.fill();
      // hp bar
      ctx.fillStyle = '#300';
      ctx.fillRect(e.x - 15, e.y - 20, 30, 4);
      ctx.fillStyle = '#f44';
      ctx.fillRect(e.x - 15, e.y - 20, 30 * (e.hp / 3), 4);
    };

    const drawObstacle = (o) => {
      ctx.fillStyle = '#2a3a2a';
      ctx.strokeStyle = '#4a7a4a';
      ctx.lineWidth = 1;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    };

    const loop = () => {
      const s = stateRef.current;
      const p = s.player;

      if (s.gameState === 'playing') {
        const dt = s.bulletTime ? 0.2 : 1;

        // Movement with world clamping
        p.x = Math.max(15, Math.min(WORLD_W - 15, p.x + s.moveStick.dx * 5 * dt));
        p.y = Math.max(15, Math.min(WORLD_H - 15, p.y + s.moveStick.dy * 5 * dt));

        // Shooting from aim stick
        if (s.aimStick.active && (s.aimStick.dx !== 0 || s.aimStick.dy !== 0)) {
          p.angle = s.aimStick.angle;
          if (Math.random() > 0.8) {
            s.bullets.push({
              x: p.x, y: p.y,
              vx: Math.cos(p.angle) * 15,
              vy: Math.sin(p.angle) * 15,
              life: 100,
              fromPlayer: true,
            });
          }
        }

        // Enemy AI
        s.enemies.forEach(en => {
          if (en.hp <= 0) return;
          const dx = p.x - en.x, dy = p.y - en.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 300) {
            en.shootCooldown -= dt;
            if (en.shootCooldown <= 0) {
              const angle = Math.atan2(dy, dx);
              s.bullets.push({ x: en.x, y: en.y, vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8, life: 80, fromPlayer: false });
              en.shootCooldown = en.type === 'sniper' ? 3 : 1.5;
            }
            if (en.type === 'agent' && dist > 80) {
              en.x += (dx / dist) * 1.5 * dt;
              en.y += (dy / dist) * 1.5 * dt;
            }
          }
        });

        // Bullet updates + hit detection
        s.bullets.forEach(b => {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;

          if (b.fromPlayer) {
            s.enemies.forEach(en => {
              if (en.hp <= 0) return;
              if (Math.hypot(b.x - en.x, b.y - en.y) < 14) {
                en.hp--;
                b.life = 0;
              }
            });
          } else {
            if (Math.hypot(b.x - p.x, b.y - p.y) < 16) {
              p.hp = Math.max(0, p.hp - 10);
              b.life = 0;
              setHud(prev => ({ ...prev, hp: p.hp }));
              if (p.hp <= 0) {
                s.gameState = 'dead';
                setHud(prev => ({ ...prev, gameState: 'dead' }));
              }
            }
          }
        });
        s.bullets = s.bullets.filter(b => b.life > 0);
        s.enemies = s.enemies.filter(en => en.hp > 0);

        if (s.enemies.length === 0 && s.gameState === 'playing') {
          s.gameState = 'win';
          setHud(prev => ({ ...prev, gameState: 'win' }));
        }

        // Camera
        s.camera.x = p.x - logicalW / 2;
        s.camera.y = p.y - logicalH / 2;

        // --- Render ---
        ctx.fillStyle = s.bulletTime ? '#0a0a14' : '#0d0d0d';
        ctx.fillRect(0, 0, logicalW, logicalH);

        // Grid
        ctx.strokeStyle = 'rgba(0,255,100,0.05)';
        ctx.lineWidth = 1;
        const gridSize = 100;
        const startX = Math.floor(s.camera.x / gridSize) * gridSize;
        const startY = Math.floor(s.camera.y / gridSize) * gridSize;
        for (let gx = startX; gx < s.camera.x + logicalW + gridSize; gx += gridSize) {
          ctx.beginPath(); ctx.moveTo(gx - s.camera.x, 0); ctx.lineTo(gx - s.camera.x, logicalH); ctx.stroke();
        }
        for (let gy = startY; gy < s.camera.y + logicalH + gridSize; gy += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, gy - s.camera.y); ctx.lineTo(logicalW, gy - s.camera.y); ctx.stroke();
        }

        ctx.save();
        ctx.translate(-s.camera.x, -s.camera.y);

        // Obstacles
        OBSTACLES.forEach(drawObstacle);

        // Enemies
        s.enemies.forEach(drawEnemy);

        // Bullets
        s.bullets.forEach(b => {
          ctx.fillStyle = b.fromPlayer ? '#ff0' : '#f66';
          ctx.shadowColor = b.fromPlayer ? '#ff0' : '#f66';
          ctx.shadowBlur = 6;
          ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
          ctx.shadowBlur = 0;
        });

        // Player
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#4f8';
        ctx.shadowColor = '#4f8';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(12, -2, 10, 4); // gun barrel
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.restore();

        // Joysticks
        if (s.moveStick.active) drawJoy(s.moveStick);
        if (s.aimStick.active) drawJoy(s.aimStick);

        // Bullet-time vignette
        if (s.bulletTime) {
          const grad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, logicalH * 0.3, logicalW / 2, logicalH / 2, logicalH * 0.8);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(1, 'rgba(0,0,80,0.4)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, logicalW, logicalH);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleTouch, { passive: false });
    window.addEventListener('touchcancel', handleTouch, { passive: false });
    window.addEventListener('resize', resize);
    resize();
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleTouch);
      window.removeEventListener('touchcancel', handleTouch);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const restart = () => {
    stateRef.current = {
      player: { x: 1600, y: 1000, hp: 100, angle: 0 },
      camera: { x: 0, y: 0 },
      bullets: [],
      enemies: ENEMY_SPAWNS.map((s, i) => ({ ...s, id: i, hp: 3, shootCooldown: 2 })),
      moveStick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, kX: 0, kY: 0 },
      aimStick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, kX: 0, kY: 0, angle: 0 },
      gameState: 'playing',
      bulletTime: false,
    };
    setHud({ hp: 100, meter: 100, gameState: 'playing' });
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden touch-none select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* HUD */}
      <div className="absolute top-4 left-4 text-green-400 font-mono text-sm pointer-events-none">
        <div>HP: <span style={{ color: hud.hp > 50 ? '#4ade80' : hud.hp > 25 ? '#facc15' : '#f87171' }}>{hud.hp}</span></div>
        <div className="mt-1">ENEMIES: {stateRef.current.enemies?.length ?? 25}</div>
      </div>

      {/* Bullet-time ability */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-6">
        <button
          className="w-16 h-16 rounded-full bg-cyan-900/50 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center text-2xl active:bg-cyan-700/50"
          onPointerDown={() => { stateRef.current.bulletTime = true; }}
          onPointerUp={() => { stateRef.current.bulletTime = false; }}
          onPointerLeave={() => { stateRef.current.bulletTime = false; }}
        >
          ❄
        </button>
      </div>

      {/* Menu */}
      {hud.gameState === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-10 text-center">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-green-400 tracking-widest">NEO ESCAPE</h1>
            <p className="text-gray-400 text-sm mb-8">Eliminate all 25 agents to escape.</p>
            <button
              className="bg-green-600 hover:bg-green-500 active:bg-green-700 px-8 py-3 rounded-full font-bold text-lg"
              onClick={restart}
            >
              START GAME
            </button>
            <p className="mt-6 text-gray-500 text-xs">Left thumb → move &nbsp;|&nbsp; Right thumb → aim &amp; shoot &nbsp;|&nbsp; ❄ → bullet time</p>
          </div>
        </div>
      )}

      {/* Dead */}
      {hud.gameState === 'dead' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white text-center">
          <div>
            <h2 className="text-3xl font-bold text-red-400 mb-4">YOU DIED</h2>
            <button className="bg-red-700 hover:bg-red-600 px-8 py-3 rounded-full font-bold" onClick={restart}>
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Win */}
      {hud.gameState === 'win' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white text-center">
          <div>
            <h2 className="text-3xl font-bold text-green-400 mb-4">ESCAPED</h2>
            <p className="text-gray-400 mb-6">All agents eliminated.</p>
            <button className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-full font-bold" onClick={restart}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
