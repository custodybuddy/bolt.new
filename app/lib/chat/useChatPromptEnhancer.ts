import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { usePromptEnhancer } from '~/lib/hooks';

interface UseChatPromptEnhancerOptions {
  input: string;
  onEnhanced?: () => void;
  setInput: Dispatch<SetStateAction<string>>;
}

export function useChatPromptEnhancer({ input, onEnhanced, setInput }: UseChatPromptEnhancerOptions) {
  const { enhancingPrompt, promptEnhanced, enhancePrompt: enhance, resetEnhancer } = usePromptEnhancer();

  const enhancePrompt = useCallback(() => {
    enhance(input, (value) => {
      setInput(value);
      onEnhanced?.();
    });
  }, [enhance, input, onEnhanced, setInput]);

  return {
    enhancePrompt,
    enhancingPrompt,
    promptEnhanced,
    resetEnhancer,
  };
}
