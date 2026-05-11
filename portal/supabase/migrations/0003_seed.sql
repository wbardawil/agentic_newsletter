-- Optional seed data for local dev. Skip in production.

insert into public.editions (
  edition_id, edition_number, published_at,
  subject_en, subject_es, body_en, body_es,
  topic, pillar, quarterly_theme,
  shareable_sentence_en, shareable_sentence_es,
  byline, byline_role,
  is_published
) values
  ('2026-18', 18, now() - interval '21 days',
   'The OS your AI rollout is missing',
   'El OS que le falta a tu rollout de IA',
   '# The OS your AI rollout is missing\n\nMost owner-operators are not failing at AI — they are failing at the operating model underneath it...',
   '# El OS que le falta a tu rollout de IA\n\nLa mayoría de los owner-operators no está fallando en IA — está fallando en el modelo operativo debajo...',
   'business_transformation', 'Operating Model OS', 'The Machine',
   'AI does not transform the business; the operating model does — AI just runs faster on top of it.',
   'La IA no transforma el negocio; el modelo operativo sí — la IA solo corre más rápido encima.',
   'Wadi Bardawil', 'Fractional CSIO',
   true),
  ('2026-19', 19, now() - interval '14 days',
   'Decision rights before dashboards',
   'Derechos de decisión antes que dashboards',
   '# Decision rights before dashboards\n\nDashboards do not produce decisions. People do. The artifact you have not written yet is the decision-rights matrix...',
   '# Derechos de decisión antes que dashboards\n\nLos dashboards no producen decisiones. La gente sí. El artefacto que no has escrito todavía es la matriz de derechos de decisión...',
   'business_transformation', 'Operating Model OS', 'The Machine',
   'The structure your team needs is not a chart — it is the artifact you have not written yet.',
   'La estructura que tu equipo necesita no es un organigrama — es el artefacto que no has escrito todavía.',
   'Wadi Bardawil', 'Fractional CSIO',
   true),
  ('2026-20', 20, now() - interval '7 days',
   'Stewardship is a posture, not a portfolio',
   'La mayordomía es una postura, no un portafolio',
   '# Stewardship is a posture, not a portfolio\n\nConscious capital is not an asset class. It is a posture toward time, talent, and trust...',
   '# La mayordomía es una postura, no un portafolio\n\nEl capital consciente no es una clase de activo. Es una postura frente al tiempo, el talento y la confianza...',
   'conscious_capital', null, 'Capital and Continuity',
   'Capital that is patient builds operators who are honest. Capital that is not, does the opposite.',
   'El capital paciente forma operadores honestos. El que no lo es, hace lo contrario.',
   'Guest contributor', 'Family Office Principal',
   true),
  ('2026-21', 21, now() - interval '0 days',
   'The succession conversation you keep postponing',
   'La conversación de sucesión que sigues postergando',
   '# The succession conversation you keep postponing\n\nThe ten-year clock starts the day the founder turns 55, not the day the founder leaves...',
   '# La conversación de sucesión que sigues postergando\n\nEl reloj de diez años empieza el día que el fundador cumple 55, no el día que el fundador se va...',
   'family_business', null, 'Capital and Continuity',
   'Succession is not a transaction. It is a decade of small, public decisions about who decides.',
   'La sucesión no es una transacción. Son diez años de decisiones pequeñas y públicas sobre quién decide.',
   'Guest contributor', 'Family Business Advisor',
   true)
on conflict (edition_id) do nothing;

insert into public.convenings (city, region, starts_at, capacity, description, language)
values
  ('Miami',     'miami',     now() + interval '14 days', 14,
   'Working dinner: deploying AI without breaking the operating model.', 'en'),
  ('Monterrey', 'monterrey', now() + interval '28 days', 12,
   'Cena de trabajo: decisiones, derechos y dashboards.',                 'es'),
  ('Bogotá',    'bogota',    now() + interval '42 days', 10,
   'Cena: continuidad familiar y mayordomía del capital.',                'es')
on conflict do nothing;
