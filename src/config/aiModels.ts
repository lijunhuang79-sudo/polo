import { GeneratedSolution } from '../types';
import {
  callDeepSeekAI,
  testDeepSeekConnection,
  callCodexAI,
  testCodexConnection,
  callQwenAI,
  testQwenConnection,
} from '../services/aiGenerator';

export type AiModelId = 'deepseek' | 'qwen' | 'codex';

export interface AiModelConfig {
  name: string;
  placeholder: string;
  modelLabel: string;
  testConnection: (apiKey: string) => Promise<boolean>;
  generate: (apiKey: string, prompt: string) => Promise<GeneratedSolution>;
}

export const AI_MODEL_CONFIGS: Record<AiModelId, AiModelConfig> = {
  deepseek: {
    name: 'DeepSeek',
    placeholder: '请输入 DeepSeek API Key (sk-...)',
    modelLabel: 'deepseek-coder (V2)',
    testConnection: testDeepSeekConnection,
    generate: callDeepSeekAI,
  },
  qwen: {
    name: 'Qwen Coder Plus',
    placeholder: '请输入 Qwen Coder Plus API Key (sk-...)',
    modelLabel: 'qwen-coder-plus (V1)',
    testConnection: testQwenConnection,
    generate: callQwenAI,
  },
  codex: {
    name: 'GPT5.2 Pro',
    placeholder: '请输入 OpenAI GPT5.2 Pro API Key (sk-...)',
    modelLabel: 'gpt-5.2-pro',
    testConnection: testCodexConnection,
    generate: callCodexAI,
  },
};
