import { supabase } from './supabase.js';

export const subjects = [
  { name: 'Physics', short: 'PH', color: 'lilac', chapters: ['Physics & Measurement', 'Kinematics', 'Laws of Motion', 'Work, Energy & Power', 'Rotational Motion', 'Gravitation', 'Properties of Solids & Liquids', 'Thermodynamics', 'Kinetic Theory of Gases', 'Oscillations & Waves', 'Electrostatics', 'Current Electricity', 'Magnetic Effects of Current & Magnetism', 'Electromagnetic Induction & AC', 'Electromagnetic Waves', 'Optics', 'Dual Nature of Matter', 'Atoms & Nuclei', 'Electronic Devices', 'Experimental Skills'] },
  { name: 'Organic Chemistry', short: 'OC', color: 'peach', chapters: ['Basic Principles of Organic Chemistry', 'Hydrocarbons', 'Haloalkanes & Haloarenes', 'Alcohols, Phenols & Ethers', 'Aldehydes, Ketones & Carboxylic Acids', 'Organic Compounds Containing Nitrogen', 'Biomolecules', 'Principles Related to Practical Chemistry'] },
  { name: 'Physical Chemistry', short: 'PC', color: 'blue', chapters: ['Some Basic Concepts of Chemistry', 'Atomic Structure', 'Chemical Bonding & Molecular Structure', 'Chemical Thermodynamics', 'Solutions', 'Equilibrium', 'Redox Reactions & Electrochemistry', 'Chemical Kinetics'] },
  { name: 'Inorganic Chemistry', short: 'IOC', color: 'sage', chapters: ['Classification of Elements & Periodicity', 'p-Block Elements', 'd- and f-Block Elements', 'Coordination Compounds'] },
  { name: 'Zoology', short: 'ZO', color: 'rose', chapters: ['Animal Kingdom', 'Structural Organisation in Animals', 'Biomolecules', 'Cell: Structure & Function', 'Human Physiology', 'Reproduction', 'Evolution', 'Human Health & Disease'] },
  { name: 'Botany', short: 'BO', color: 'green', chapters: ['Diversity in Living World', 'Plant Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Cell: Structure & Function', 'Plant Physiology', 'Sexual Reproduction in Flowering Plants', 'Genetics & Evolution', 'Biology & Human Welfare', 'Biotechnology', 'Ecology & Environment'] },
];

export const todayKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export async function loadAll(userId) {
  const [profile, chapters, tasks, sessions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('chapters').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('study_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
  ]);
  for (const result of [profile, chapters, tasks, sessions]) if (result.error) throw result.error;
  return { profile: profile.data, chapters: chapters.data ?? [], tasks: tasks.data ?? [], sessions: sessions.data ?? [] };
}

export async function ensureChapters(userId, saved) {
  const existing = new Set(saved.map(chapter => `${chapter.subject}|${chapter.name}`));
  const missing = subjects.flatMap(subject => subject.chapters
    .filter(name => !existing.has(`${subject.name}|${name}`))
    .map(name => ({ user_id: userId, subject: subject.name, name, status: 'not_started', progress: 0 })));
  if (!missing.length) return saved;
  const { data, error } = await supabase.from('chapters').insert(missing).select();
  if (error) throw error;
  return [...saved, ...data];
}

export function statsFrom(data) {
  const today = todayKey();
  const dailySeconds = new Map();
  const sessionSeconds = session => Number(session.duration_seconds ?? Number(session.duration_minutes || 0) * 60);
  for (const session of data.sessions) {
    if (!session.completed) continue;
    dailySeconds.set(session.study_date, (dailySeconds.get(session.study_date) ?? 0) + sessionSeconds(session));
  }

  const cursor = new Date(`${today}T12:00:00`);
  if (!dailySeconds.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dailySeconds.has(todayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  let longest = 0, run = 0, previous = null;
  for (const day of [...dailySeconds.keys()].sort()) {
    const date = new Date(`${day}T12:00:00`);
    run = previous && (date - previous) / 86400000 === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const subjectsProgress = subjects.map(subject => {
    const chapters = data.chapters.filter(chapter => chapter.subject === subject.name);
    const percent = chapters.length
      ? Math.round(chapters.reduce((sum, chapter) => sum + Number(chapter.progress || 0), 0) / chapters.length)
      : 0;
    return { ...subject, chapters, percent, completed: chapters.filter(chapter => chapter.status === 'completed').length };
  });
  const studySeconds = data.sessions.filter(session => session.completed).reduce((sum, session) => sum + sessionSeconds(session), 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = todayKey(date);
    return { key, label: date.toLocaleDateString('en', { weekday: 'short' }), minutes: Math.round((dailySeconds.get(key) ?? 0) / 60) };
  });

  return {
    today,
    dailySeconds,
    streak,
    longest,
    done: data.tasks.filter(task => task.completed).length,
    studySeconds,
    todaySeconds: dailySeconds.get(today) ?? 0,
    subjectsProgress,
    overall: Math.round(subjectsProgress.reduce((sum, subject) => sum + subject.percent, 0) / 6),
    completedChapters: data.chapters.filter(chapter => chapter.status === 'completed').length,
    week,
  };
}
