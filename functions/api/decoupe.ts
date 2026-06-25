import Anthropic from '@anthropic-ai/sdk'

interface Env {
  ANTHROPIC_API_KEY: string
}

interface CorpsRequete {
  titre?: string
  description?: string | null
  pourquoi?: string | null
  categorie?: string | null
  nombre?: number
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sousTaches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          titre: { type: 'string' },
          dureeEstimeeMin: { type: 'integer' },
          niveauEnergie: { type: 'string', enum: ['micro', 'faible', 'moyenne', 'haute'] }
        },
        required: ['titre', 'dureeEstimeeMin', 'niveauEnergie']
      }
    }
  },
  required: ['sousTaches']
}

const SYSTEME = `Tu aides une personne avec un TDAH à découper une tâche en étapes concrètes et actionnables.
Règles :
- Produis exactement le nombre d'étapes demandé, dans l'ordre logique de réalisation.
- Chaque étape commence par un verbe d'action et doit être démarrable immédiatement.
- Estime une durée réaliste (dureeEstimeeMin) et un niveau d'énergie (micro/faible/moyenne/haute).
- Réponds en français.`

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let corps: CorpsRequete
  try {
    corps = await context.request.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }

  const titre = (corps.titre ?? '').trim()
  if (!titre) return json({ error: 'titre requis' }, 400)
  const nombre = Math.max(2, Math.min(6, Math.round(Number(corps.nombre) || 3)))

  if (!context.env.ANTHROPIC_API_KEY) {
    return json({ error: 'clé API absente côté serveur' }, 500)
  }

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY })

  const contexte = [
    `Tâche à découper : ${titre}`,
    corps.description ? `Description : ${corps.description}` : '',
    corps.pourquoi ? `Pourquoi c'est important : ${corps.pourquoi}` : '',
    corps.categorie ? `Catégorie : ${corps.categorie}` : '',
    `Découpe-la en exactement ${nombre} sous-tâches.`
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEME,
      messages: [{ role: 'user', content: contexte }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    } as Anthropic.MessageCreateParamsNonStreaming)

    const bloc = message.content.find((b) => b.type === 'text')
    const texte = bloc && bloc.type === 'text' ? bloc.text : '{}'
    const parsed = JSON.parse(texte) as { sousTaches?: unknown[] }
    return json({ sousTaches: Array.isArray(parsed.sousTaches) ? parsed.sousTaches.slice(0, nombre) : [] })
  } catch (e) {
    return json({ error: `appel Claude échoué : ${(e as Error).message}` }, 502)
  }
}
