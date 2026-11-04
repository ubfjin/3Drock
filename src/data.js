import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const demoMode = !supabaseUrl || !supabaseKey;
export const supabase = demoMode ? null : createClient(supabaseUrl, supabaseKey);

export const defaultQuestions = [
  '암석 시료에서 관찰된 특징을 쓰시오.',
  '암석 관찰 결과를 기반으로 이 암석의 종류를 추정하고, 그렇게 생각한 이유를 쓰시오. (화성암, 퇴적암, 변성암)',
  '이 암석이 어떻게 관찰된 특징들을 갖게 되었는지 추론하고, 그렇게 생각한 이유를 쓰시오.',
];

const demoKey = 'rocklab-classroom-demo-v1';
function demoData() {
  try {
    const saved = JSON.parse(localStorage.getItem(demoKey));
    if (saved?.models?.length && saved?.questions?.length === 3) return saved;
  } catch { /* reset invalid local preview */ }
  return {
    models: [
      { id: 'sample-01', sample_no: 1, order_index: 1, active: true, asset_url: '/models/sample-01.glb', credit_public: 'phaneritic · CC BY 4.0', private_title: '예시 시료 01' },
      { id: 'sample-02', sample_no: 2, order_index: 2, active: true, asset_url: '/models/sample-02.glb', credit_public: 'rocksandminerals · CC BY 4.0', private_title: '예시 시료 02' },
    ],
    questions: defaultQuestions.map((prompt, i) => ({ position: i + 1, prompt })),
    responses: {},
  };
}
function writeDemo(data) { localStorage.setItem(demoKey, JSON.stringify(data)); }
const check = ({ data, error }) => { if (error) throw error; return data; };

export async function currentIdentity() {
  if (demoMode) {
    const role = sessionStorage.getItem('rocklab-demo-role');
    return role ? { role, user: { id: role === 'teacher' ? 'demo-teacher' : 'demo-student', email: role === 'teacher' ? '' : 'student@example.com', user_metadata: { full_name: '미리보기 학생' } } } : null;
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const teacher = check(await supabase.rpc('is_teacher'));
  if (teacher) return { role: 'teacher', user };
  if (user.is_anonymous) return null;
  return { role: 'student', user };
}

export function previewSignIn(role) {
  sessionStorage.setItem('rocklab-demo-role', role);
  return currentIdentity();
}

export async function googleSignIn() {
  if (demoMode) return previewSignIn('student');
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) throw error;
}

export async function teacherSignIn(code) {
  if (demoMode) {
    const previewCode = import.meta.env.VITE_PREVIEW_TEACHER_CODE;
    if (previewCode && code !== previewCode) throw new Error('접근 코드가 올바르지 않습니다.');
    return previewSignIn('teacher');
  }
  await supabase.auth.signOut();
  const { error: anonymousError } = await supabase.auth.signInAnonymously();
  if (anonymousError) throw anonymousError;
  const { data, error } = await supabase.rpc('claim_teacher', { access_code: code });
  if (error || !data) {
    await supabase.auth.signOut();
    throw error || new Error('접근 코드가 올바르지 않습니다.');
  }
  return currentIdentity();
}

export async function signOut() {
  if (demoMode) sessionStorage.removeItem('rocklab-demo-role');
  else check(await supabase.auth.signOut());
}

export async function loadClassroom(role, userId) {
  if (demoMode) {
    const saved = demoData();
    return {
      models: [...saved.models].filter((m) => role === 'teacher' || m.active).sort((a, b) => a.order_index - b.order_index),
      questions: [...saved.questions].sort((a, b) => a.position - b.position),
      responses: role === 'student' ? Object.values(saved.responses).filter((r) => r.user_id === userId) : Object.values(saved.responses),
      profiles: role === 'teacher' ? [{ id: 'demo-student', email: 'student@example.com', display_name: '미리보기 학생' }] : [],
    };
  }
  const [modelsResult, questionsResult, responsesResult] = await Promise.all([
    supabase.from('models').select('*').order('order_index'),
    supabase.from('questions').select('*').order('position'),
    supabase.from('responses').select('*'),
  ]);
  const models = check(modelsResult), questions = check(questionsResult), responses = check(responsesResult);
  let profiles = [];
  if (role === 'teacher') {
    const [detailsResult, profilesResult] = await Promise.all([
      supabase.from('model_details').select('*'),
      supabase.from('profiles').select('*').neq('email', ''),
    ]);
    const details = new Map(check(detailsResult).map((row) => [row.model_id, row]));
    models.forEach((model) => Object.assign(model, details.get(model.id) || {}));
    profiles = check(profilesResult);
  }
  return { models, questions, responses, profiles };
}

export function modelUrl(model) {
  if (model.asset_url) return model.asset_url;
  return supabase.storage.from('rock-models').getPublicUrl(model.storage_path).data.publicUrl;
}

export async function saveDraft(userId, modelId, answers) {
  const payload = { user_id: userId, model_id: modelId, draft_answers: answers, updated_at: new Date().toISOString() };
  if (demoMode) {
    const saved = demoData();
    const key = `${userId}:${modelId}`;
    saved.responses[key] = { ...saved.responses[key], ...payload, submitted_answers: saved.responses[key]?.submitted_answers || null, submitted_at: saved.responses[key]?.submitted_at || null, submission_count: saved.responses[key]?.submission_count || 0 };
    writeDemo(saved);
    return saved.responses[key];
  }
  return check(await supabase.from('responses').upsert(payload, { onConflict: 'user_id,model_id' }).select().single());
}

export async function submitAll(userId) {
  if (demoMode) {
    const saved = demoData();
    const active = saved.models.filter((m) => m.active);
    if (active.some((m) => [1, 2, 3].some((n) => !saved.responses[`${userId}:${m.id}`]?.draft_answers?.[n]?.trim()))) throw new Error('모든 시료의 세 문항을 작성해 주세요.');
    const submittedAt = new Date().toISOString();
    active.forEach((m) => {
      const response = saved.responses[`${userId}:${m.id}`];
      response.submitted_answers = { ...response.draft_answers };
      response.submitted_at = submittedAt;
      response.submission_count += 1;
    });
    writeDemo(saved);
    return submittedAt;
  }
  return check(await supabase.rpc('submit_all_responses'));
}

export async function saveQuestions(questions) {
  if (demoMode) { const saved = demoData(); saved.questions = questions; writeDemo(saved); return; }
  check(await supabase.from('questions').upsert(questions.map(({ position, prompt }) => ({ position, prompt, updated_at: new Date().toISOString() }))));
}

export async function saveModelOrder(models) {
  if (demoMode) { const saved = demoData(); saved.models = models; writeDemo(saved); return; }
  for (const model of models) check(await supabase.from('models').update({ order_index: model.order_index, active: model.active }).eq('id', model.id));
}

async function sanitizeGlb(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (String.fromCharCode(...bytes.slice(0, 4)) !== 'glTF' || view.getUint32(4, true) !== 2) throw new Error('GLB 2.0 파일만 등록할 수 있습니다.');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const strip = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'name' || key === 'extras') delete value[key];
      else strip(child);
    }
  };
  strip(json);
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(encoded.length / 4) * 4;
  const tail = bytes.subarray(20 + jsonLength);
  const output = new Uint8Array(20 + padded + tail.length);
  const header = new DataView(output.buffer);
  output.set([103, 108, 84, 70]);
  header.setUint32(4, 2, true);
  header.setUint32(8, output.length, true);
  header.setUint32(12, padded, true);
  header.setUint32(16, 0x4e4f534a, true);
  output.set(encoded, 20);
  output.fill(32, 20 + encoded.length, 20 + padded);
  output.set(tail, 20 + padded);
  return new Blob([output], { type: 'model/gltf-binary' });
}

export async function addModel({ file, title, credit, sourceUrl, onProgress }) {
  if (demoMode) throw new Error('모델 업로드는 데이터베이스 연결 후 사용할 수 있습니다.');
  const cleanFile = await sanitizeGlb(file);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('교사 로그인이 필요합니다.');
  const path = `${crypto.randomUUID()}.glb`;
  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(cleanFile, {
      endpoint,
      headers: { authorization: `Bearer ${session.access_token}`, apikey: supabaseKey },
      metadata: { bucketName: 'rock-models', objectName: path, contentType: 'model/gltf-binary', cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      onError: reject,
      onProgress: (uploaded, total) => onProgress?.(Math.round(uploaded / total * 100)),
      onSuccess: resolve,
    });
    upload.start();
  });
  const { data: previous } = await supabase.from('models').select('sample_no,order_index').order('sample_no', { ascending: false }).limit(1);
  const nextNo = (previous?.[0]?.sample_no || 0) + 1;
  const model = check(await supabase.from('models').insert({ sample_no: nextNo, order_index: nextNo, active: true, storage_path: path, credit_public: credit || '' }).select().single());
  check(await supabase.from('model_details').insert({ model_id: model.id, private_title: title, source_url: sourceUrl || null }));
  return model;
}
