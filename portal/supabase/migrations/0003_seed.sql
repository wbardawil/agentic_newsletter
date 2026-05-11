-- Optional seed data for local dev. Skip in production.

insert into public.editions (edition_id, edition_number, published_at, subject_en, subject_es,
                             body_en, body_es, pillar, quarterly_theme,
                             shareable_sentence_en, shareable_sentence_es, is_published)
values
  ('2026-18', 18, now() - interval '7 days',
   'The OS your AI rollout is missing',
   'El OS que le falta a tu rollout de IA',
   '# The OS your AI rollout is missing\n\nMost owner-operators are not failing at AI — they are failing at the operating model underneath it...',
   '# El OS que le falta a tu rollout de IA\n\nLa mayoría de los owner-operators no está fallando en IA — está fallando en el modelo operativo debajo...',
   'Operating Model OS', 'The Machine',
   'AI does not transform the business; the operating model does — AI just runs faster on top of it.',
   'La IA no transforma el negocio; el modelo operativo sí — la IA solo corre más rápido encima.',
   true),
  ('2026-19', 19, now() - interval '0 days',
   'Decision rights before dashboards',
   'Derechos de decisión antes que dashboards',
   '# Decision rights before dashboards\n\nDashboards do not produce decisions. People do. The artifact you have not written yet is the decision-rights matrix...',
   '# Derechos de decisión antes que dashboards\n\nLos dashboards no producen decisiones. La gente sí. El artefacto que no has escrito todavía es la matriz de derechos de decisión...',
   'Operating Model OS', 'The Machine',
   'The structure your team needs is not a chart — it is the artifact you have not written yet.',
   'La estructura que tu equipo necesita no es un organigrama — es el artefacto que no has escrito todavía.',
   true)
on conflict (edition_id) do nothing;

insert into public.convenings (city, region, starts_at, capacity, description, language)
values
  ('Miami',     'miami',     now() + interval '14 days', 14,
   'Working dinner: deploying AI without breaking the operating model.', 'en'),
  ('Monterrey', 'monterrey', now() + interval '28 days', 12,
   'Cena de trabajo: decisiones, derechos y dashboards.',                 'es')
on conflict do nothing;
