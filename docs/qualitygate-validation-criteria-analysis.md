# **Analisis de los criterios validados por el agente QualityGate**

El agente de Quality Gate valida los drafts según cuatro criterios principales. El más importante es la **verificación de hechos**, que constituye un filtro estricto: si alguna afirmación específica del draft no está respaldada por los materiales de referencia proporcionados, el draft se rechaza. Los otros tres criterios funcionan como filtros «flexibles» o advertencias.

Criterios de validación detallados:

**1\. Verificación de hechos (barrera estricta):**

* **Lógica:** Cada afirmación específica, estadística, entidad nombrada o cita directa, tanto en el draft en inglés como en el de español, debe poder verificarse con respecto a los «verbatimFacts» proporcionados en el paquete de fuentes.  
* **Condiciones de falla:** El draft no cumple si el tiempo verbal de una afirmación no coincide con el de la fuente (p. ej., «adquirió» frente a «adquirirá»), si afirma una intención sin respaldo explícito o si generaliza una tendencia amplia a partir de un solo dato.  
* **Exclusiones:** La sección de recomendaciones sobre «Herramientas» y las declaraciones generales sobre el marco no se someten a verificación de hechos.

**2\. Originalidad del enfoque (Advertencia):**

* **Lógica:** El agente compara el enfoque estratégico del draft con las últimas 8 ediciones publicadas para evitar repeticiones.  
* **Umbral:** Emite una advertencia si detecta una similitud semántica del 70 % o más con cualquier enfoque reciente.

**3\. Coincidencia de voz (puntuación):**

* **Lógica:** Se comparan el tono y el estilo de la sección «Perspectiva» del draft con una «Biblia de la voz» que contiene ejemplos de referencia.  
* **Resultado:** El agente proporciona una puntuación de voz (0-100) y enumera cualquier desviación específica respecto a la voz establecida.

**4\. Diversidad de fuentes (verificación determinista):**

* **Lógica:** Esta verificación la realiza el código, no el LLM. Cuenta el número de fuentes únicas al analizar todos los enlaces Markdown del draft.  
* **Umbral:** Se sugiere una advertencia si el draft utiliza menos de tres fuentes distintas.

Este desglose confirma que la **verificación de hechos** es el único criterio estricto de aprobado/reprobado. Para flexibilizar el filtro, podríamos ajustar la lógica de las otras tres verificaciones o cambiar la forma en que se interpretan sus advertencias, pero el mecanismo de verificación de hechos está diseñado para ser rígido.


# **Plan Estratégico para la Flexibilización del Agente Quality Gate**

**Objetivo**: Ajustar los criterios de validación no críticos del agente Quality Gate para aumentar la tasa de aprobación de drafts, reducir falsos negativos y mejorar la autonomía del pipeline, sin sacrificar la calidad editorial esencial.

A continuación, se desglosan las alternativas, riesgos y justificaciones para cada uno de los tres criterios a flexibilizar.

## **1\. Originalidad del Ángulo (Angle Originality)**

Este criterio previene la repetición de temas, emitiendo una advertencia si detecta una similitud semántica del **70% o más** con los últimos 8 drafts.

**Alternativas de Flexibilización**

* **Elevar el Umbral de Similitud:** Aumentar el umbral del 70% a un 80% o 85%.  
* **Reducir la Ventana de Comparación:** En lugar de comparar con los últimos 8 drafts (2 meses), reducir la ventana a los últimos 4 drafts (1 mes).  
* **Implementar un Sistema de Alerta por Niveles:**  
  * **Nivel 1 (Advertencia):** Similitud del 75% al 84%. El sistema lo anota pero aprueba el draft.  
  * **Nivel 2 (Revisión Humana):** Similitud del 85% o más. El draft es retenido y requiere una anulación manual.

**Análisis de Riesgos**

* **Riesgo General:** Fatiga de la audiencia; si los temas son repetitivos, el valor percibido disminuye.  
* **Elevar Umbral:** Podría permitir el paso de ángulos muy similares que el lector perciba como duplicados.  
* **Reducir Ventana:** Revisitación prematura de temas sin aportar valor sustancialmente nuevo.  
* **Alerta por Niveles:** Aumenta la complejidad del agente y requiere mayor intervención humana en el Nivel 2\.

**Justificación de Soluciones**

**\- Elevar Umbral:** Se justifica porque un 70% puede ser demasiado sensible, especialmente para un newsletter de nicho donde los temas centrales (ej. "modelo operativo", "IA") se repiten por naturaleza. Elevar el umbral a 80% permite variaciones sobre un mismo tema, confiando en que el agente Writer ha generado un contenido único y con un enfoque distinto.

**\- Alerta por Niveles:** Esta es la solución más robusta. Justifica un enfoque equilibrado: se automatiza la aprobación de contenido con una superposición temática razonable (hasta 84%) pero se asegura que los casos de repetición muy alta sean validados por un humano. Esto mantiene la agilidad sin eliminar el control de calidad en los casos más extremos.

## **2\. Coherencia de Voz (Voice Match)**

Este criterio genera una **puntuación (0-100)** y enumera desviaciones, funcionando actualmente como una métrica informativa.

**Alternativas de Flexibilización**

* **Umbral Mínimo de Aprobación:** Convertirlo en un "soft gate" donde puntuaciones bajo 75 generen advertencia.  
* **Clasificar Severidad:** Diferenciar entre desviaciones "Menores" y "Críticas" (ej. tono promocional vs analítico).  
* **Mecanismo de Auto-Corrección:** Intentar reescribir frases alineándolas con la "biblia de voz".

**Análisis de Riesgos**

* **Riesgo General:** Pérdida de identidad de marca y consistencia clave para la lealtad.  
* **Umbral Mínimo:** Arbitrariedad numérica; el score puede no capturar problemas de tono fundamentales.  
* **Clasificar Severidad:** La clasificación de severidad por parte del LLM es inherentemente subjetiva y podría ser imprecisa, dejando pasar errores críticos o bloqueando problemas menores.  
* **Auto-Corrección:** Puede sonar robótica, alterar significados o introducir errores semánticos.

**Justificación de Soluciones**

**\- Clasificar Severidad:** Esta alternativa ofrece el mayor valor. Permite al sistema diferenciar entre una peculiaridad estilística menor y un error de tono grave. La justificación es que el objetivo no es la perfección robótica, sino evitar desviaciones que rompan la conexión con el lector. Se puede instruir al LLM para que se enfoque en problemas de tono, formalidad y perspectiva, ignorando variaciones menores.

## **3\. Diversidad de Fuentes (Source Diversity)**

Chequeo determinístico que advierte si hay menos de **3 fuentes únicas**.

**Alternativas de Flexibilización**

* **Reducir el Umbral Mínimo:** Bajar el requisito de 3 a 2 fuentes únicas.  
* **Sensibilidad al Contexto:** Permitir justificaciones (isDeepDive) para análisis profundos de una sola fuente.  
* **Ponderar Calidad:** Fuentes de alta autoridad (ej. HBR) podrían contar doble.

**Análisis de Riesgos**

* **Riesgo General:** Afectación a la credibilidad y percepción de rigor periodístico.  
* **Reducir Umbral:** Podría incentivar la producción de artículos con menor investigación y una perspectiva más limitada.  
* **Sensible al Contexto:** Introduce subjetividad si el LLM evalúa la validez de la justificación.  
* **Ponderar Fuentes:** Complejidad técnica para mantener y actualizar la lista de autoridades.

**Justificación de Soluciones**

\- **Sensible al Contexto:** Esta es la solución más inteligente y alineada con los objetivos editoriales. Se justifica porque hay formatos de contenido legítimos (ej. resumen de libro, análisis de un paper) donde la multiplicidad de fuentes no es un indicador de calidad. Implementarlo a través de un simple flag que el Strategist pueda activar (justificationForLowSourceCount: "Análisis del reporte anual de McKinsey") permitiría al QualityGate omitir el chequeo de forma controlada y trazable.

**Resumen de Recomendaciones y Próximos Pasos**

Se recomienda proceder con un enfoque equilibrado, implementando las siguientes soluciones:  
**1\. Originalidad:** Implementar el sistema de alerta por niveles para automatizar la mayoría de los casos y reservar la intervención humana solo para las repeticiones más evidentes.  
**2\. Voz:** Implementar la clasificación de severidad de desviaciones para centrar la atención en problemas de tono críticos y no en minucias estilísticas.  
**3\. Fuentes:** Hacer el criterio sensible al contexto, permitiendo que se justifique un número bajo de fuentes para formatos de contenido específicos como los "deep dives".

**Nota importante:** El criterio de Verificación de Hechos (Fact Verification) debe permanecer como una compuerta estricta e inflexible. La credibilidad factual no es negociable.  
