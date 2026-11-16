import React, { useState } from 'react';
import Viewer from './Viewer.jsx';
import { modelUrl } from './data.js';

export default function Guest({ models, onHome, onLogin }) {
  const [selected, setSelected] = useState(0);
  if (!models.length) return <div className="empty-page"><h2>아직 관찰할 시료가 없습니다.</h2><p>공개된 시료가 등록되면 이곳에서 관찰할 수 있습니다.</p><button onClick={onHome}>홈으로</button></div>;
  const model = models[selected];
  return <main className="guest-page reference-workspace">
    <aside className="sample-rail" aria-label="시료 목록"><nav aria-label="암석 시료 목록">
      {models.map((item, index) => <button key={item.sample_no} className={`sample-link ${index === selected ? 'selected' : ''}`} onClick={() => setSelected(index)} aria-current={index === selected ? 'true' : undefined}>
        <span className="sample-number">{String(index + 1).padStart(2, '0')}</span><span className="sample-title">시료 {String(index + 1).padStart(2, '0')}</span>
      </button>)}
    </nav><div className="guest-rail-note">시료를 선택하고 자유롭게 회전·확대해 보세요.</div></aside>
    <section className="student-view" aria-label="3D 암석 관찰"><Viewer key={model.sample_no} url={modelUrl(model)} sampleNo={selected + 1} onPrevious={() => setSelected((selected - 1 + models.length) % models.length)} onNext={() => setSelected((selected + 1) % models.length)} /></section>
    <div className="guest-login-hint"><span>관찰 내용을 보고서로 남기고 싶나요?</span><button onClick={onLogin}>Google 로그인하고 보고서 작성 →</button></div>
  </main>;
}
