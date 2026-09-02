-- Development seed: the catalogue for Phase 1 and default thresholds.
-- Topic content is imported from supabase/seed/content by the importer, not here.

insert into public.subjects (id, name, board, phase, colour, sort) values
  ('maths', 'Mathematics', 'Edexcel 1MA1', 1, '#0E7A86', 1),
  ('physics', 'Physics', 'AQA 8463', 1, '#5A4BD1', 2),
  ('chemistry', 'Chemistry', 'AQA 8462', 2, '#B5451B', 3),
  ('biology', 'Biology', 'Edexcel 1BI0', 2, '#2E8B57', 4),
  ('computer-science', 'Computer Science', 'AQA 8525', 3, '#1F3A93', 5),
  ('business', 'Business', 'Edexcel 1BS0', 3, '#8A6D1D', 6),
  ('french', 'French', 'Edexcel 1FR1', 3, '#A83E6B', 7),
  ('music', 'Music', 'Board to confirm', 3, '#6B4E9B', 8);

insert into public.subject_thresholds (subject_id) select id from public.subjects;

insert into public.units (subject_id, id, name, sort) values
  ('maths', 'number', 'Number', 1),
  ('maths', 'algebra', 'Algebra', 2),
  ('maths', 'ratio-proportion-and-rates-of-change', 'Ratio, proportion and rates of change', 3),
  ('maths', 'geometry-and-measures', 'Geometry and measures', 4),
  ('maths', 'probability', 'Probability', 5),
  ('maths', 'statistics', 'Statistics', 6),
  ('physics', 'energy', 'Energy', 1),
  ('physics', 'electricity', 'Electricity', 2),
  ('physics', 'particle-model-of-matter', 'Particle model of matter', 3),
  ('physics', 'atomic-structure', 'Atomic structure', 4),
  ('physics', 'forces', 'Forces', 5),
  ('physics', 'waves', 'Waves', 6),
  ('physics', 'magnetism-and-electromagnetism', 'Magnetism and electromagnetism', 7),
  ('physics', 'space-physics', 'Space physics', 8);

-- Topic rows for the sample pack. Their content versions are loaded by the importer.
insert into public.topics (id, subject_id, unit_id, title, sort) values
  ('laws-of-indices', 'maths', 'number', 'Laws of indices', 1),
  ('kinetic-and-gravitational-potential-energy', 'physics', 'energy', 'Kinetic and gravitational potential energy', 2);
