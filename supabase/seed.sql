-- Development seed: the catalogue for Phase 1 and default thresholds.
-- Topic content is imported from supabase/seed/content by the importer, not here.

insert into public.subjects (id, name, board, phase, colour, sort) values
  ('maths', 'Mathematics', 'Edexcel 1MA1', 1, '#0E7A86', 1),
  ('further-maths', 'Further Maths', 'AQA Level 2 (8365)', 2, '#0F5E9C', 2),
  ('physics', 'Physics', 'AQA 8463', 1, '#5A4BD1', 3),
  ('chemistry', 'Chemistry', 'AQA 8462', 2, '#B5451B', 4),
  ('biology', 'Biology', 'Edexcel 1BI0', 2, '#2E8B57', 5),
  ('computer-science', 'Computer Science', 'AQA 8525', 3, '#1F3A93', 6),
  ('business', 'Business', 'Edexcel 1BS0', 3, '#8A6D1D', 7),
  ('french', 'French', 'Edexcel 1FR1', 3, '#A83E6B', 8),
  ('music', 'Music', 'Edexcel 1MU0', 3, '#6B4E9B', 9);

insert into public.subject_thresholds (subject_id) select id from public.subjects;

insert into public.units (subject_id, id, name, sort) values
  ('further-maths', 'number', 'Number', 1),
  ('further-maths', 'algebra', 'Algebra', 2),
  ('further-maths', 'coordinate-geometry', 'Coordinate geometry', 3),
  ('further-maths', 'calculus', 'Calculus', 4),
  ('further-maths', 'matrix-transformations', 'Matrix transformations', 5),
  ('further-maths', 'geometry', 'Geometry', 6),
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

-- Units for the Phase 2 and 3 subjects, so topics can be imported as they are written.
insert into public.units (subject_id, id, name, sort) values
  ('chemistry', 'atomic-structure-and-the-periodic-table', 'Atomic structure and the periodic table', 1),
  ('chemistry', 'bonding-structure-and-properties', 'Bonding, structure and properties', 2),
  ('chemistry', 'quantitative-chemistry', 'Quantitative chemistry', 3),
  ('chemistry', 'chemical-changes', 'Chemical changes', 4),
  ('chemistry', 'energy-changes', 'Energy changes', 5),
  ('chemistry', 'rate-and-extent-of-change', 'Rate and extent of change', 6),
  ('chemistry', 'organic-chemistry', 'Organic chemistry', 7),
  ('chemistry', 'chemical-analysis', 'Chemical analysis', 8),
  ('chemistry', 'chemistry-of-the-atmosphere', 'Chemistry of the atmosphere', 9),
  ('chemistry', 'using-resources', 'Using resources', 10),
  ('biology', 'key-concepts', 'Key concepts', 1),
  ('biology', 'cells-and-control', 'Cells and control', 2),
  ('biology', 'genetics', 'Genetics', 3),
  ('biology', 'natural-selection-and-genetic-modification', 'Natural selection and genetic modification', 4),
  ('biology', 'health-disease-and-medicine', 'Health, disease and medicine', 5),
  ('biology', 'plant-structures', 'Plant structures', 6),
  ('biology', 'animal-coordination-and-homeostasis', 'Animal coordination and homeostasis', 7),
  ('biology', 'exchange-and-transport', 'Exchange and transport', 8),
  ('biology', 'ecosystems-and-material-cycles', 'Ecosystems and material cycles', 9),
  ('computer-science', 'fundamentals-of-algorithms', 'Fundamentals of algorithms', 1),
  ('computer-science', 'programming', 'Programming', 2),
  ('computer-science', 'data-representation', 'Data representation', 3),
  ('computer-science', 'computer-systems', 'Computer systems', 4),
  ('computer-science', 'networks', 'Networks', 5),
  ('computer-science', 'cyber-security', 'Cyber security', 6),
  ('computer-science', 'relational-databases-and-sql', 'Relational databases and SQL', 7),
  ('computer-science', 'ethical-legal-and-environmental-impacts', 'Ethical, legal and environmental impacts', 8),
  ('business', 'theme-1-investigating-small-business', 'Theme 1: Investigating small business', 1),
  ('business', 'theme-2-building-a-business', 'Theme 2: Building a business', 2),
  ('french', 'my-personal-world', 'My personal world', 1),
  ('french', 'lifestyle-and-wellbeing', 'Lifestyle and wellbeing', 2),
  ('french', 'my-neighbourhood', 'My neighbourhood', 3),
  ('french', 'media-and-technology', 'Media and technology', 4),
  ('french', 'studying-and-my-future', 'Studying and my future', 5),
  ('french', 'travel-and-tourism', 'Travel and tourism', 6),
  ('music', 'musical-elements', 'Musical elements and language', 1),
  ('music', 'instrumental-music-1700-1820', 'Instrumental music 1700 to 1820', 2),
  ('music', 'vocal-music', 'Vocal music', 3),
  ('music', 'music-for-stage-and-screen', 'Music for stage and screen', 4),
  ('music', 'fusions', 'Fusions', 5);
