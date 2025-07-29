import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = true;
env.allowLocalModels = false;  
// Check that it exists before setting it
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
  env.backends.onnx.wasm.numThreads = 1;
}

let nerPipeline: any = null;

export async function loadNerPipeline(): Promise<any> {
    if (nerPipeline) return nerPipeline;

    nerPipeline = await pipeline('token-classification', 'donteattofu/calighter-model', {
        progress_callback: console.log,
    });

    return nerPipeline;
}

interface Entity {
        text?: string;
        score?: number;
        start?: number;
        end?: number;
    }

interface NERResult {
    EVENT: Entity[];
    TIME: Entity[];
    LOCATION: Entity[];
}

function getEntityType(tag: string): keyof NERResult | null {
    if (tag === 'B-EVENT' || tag === 'I-EVENT') return 'EVENT';
    if (tag === 'B-TIME' || tag === 'I-TIME') return 'TIME';
    if (tag === 'B-LOCATION' || tag === 'I-LOCATION') return 'LOCATION';
    return null;
}

function detokenize(words: string[]): string {
    let output = "";
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.startsWith("##")) {
            output += word.slice(2); // merge with previous token
        } else if (output.length > 0 && !/^[.,!?]$/.test(word)) {
            output += " " + word;
        } else {
            output += word;
        }
    }
    return output;
}

export async function runModel(text: string): Promise<NERResult> {
    if (!nerPipeline) {
        console.error("NER pipeline is not loaded.");
        return { EVENT: [], TIME: [], LOCATION: [] };
    }

    try {
        const tokens = await nerPipeline(text, { aggregation_strategy: 'none' });

        const entities: NERResult = {
            EVENT: [],
            TIME: [],
            LOCATION: []
        };

        let current: {
            type: keyof NERResult;
            tokens: string[];
            scoreSum: number;
            count: number;
        } | null = null;

        for (const token of tokens) {
            const tag = token.entity; // e.g., B-TIME, I-EVENT
            const type = getEntityType(tag);
            const isBegin = tag.startsWith('B-');
            const isInside = tag.startsWith('I-');

            const shouldFlush =
                !type || isBegin || (current && type !== current.type);

            if (shouldFlush && current) {
                const phraseLower = detokenize(current.tokens).toLowerCase();
                const matchIndex = text.toLowerCase().indexOf(phraseLower);

                let originalCasedPhrase = phraseLower;
                if (matchIndex !== -1) {
                    originalCasedPhrase = text.slice(matchIndex, matchIndex + phraseLower.length);
                }

                entities[current.type].push({
                    text: originalCasedPhrase,
                    score: current.scoreSum / current.count
                });
                current = null;
            }

            if (type && (isBegin || (!current && isInside))) {
                current = {
                    type,
                    tokens: [token.word],
                    scoreSum: token.score,
                    count: 1
                };
            } else if (current && isInside && type === current.type) {
                current.tokens.push(token.word);
                current.scoreSum += token.score;
                current.count += 1;
            }
        }

        // Final flush
        if (current) {
            const phraseLower = detokenize(current.tokens).toLowerCase();
            const matchIndex = text.toLowerCase().indexOf(phraseLower);

            let originalCasedPhrase = phraseLower;
            if (matchIndex !== -1) {
                originalCasedPhrase = text.slice(matchIndex, matchIndex + phraseLower.length);
            }
            entities[current.type].push({
                text: originalCasedPhrase,
                score: current.scoreSum / current.count
            });
        }

        (['EVENT', 'LOCATION'] as (keyof NERResult)[]).forEach(type => {
            if (entities[type].length > 1) {
                entities[type].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                entities[type] = [entities[type][0]];
            }
        });

        return entities;

    } catch (error) {
        console.error("Error running NER model:", error);
        return { EVENT: [], TIME: [], LOCATION: [] };
    }
}