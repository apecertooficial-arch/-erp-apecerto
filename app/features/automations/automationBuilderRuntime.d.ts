type AutomationBuilderRuntime = {
  mount(host: HTMLDivElement, context: { authToken: string }): void;
  unmount(): void;
  isMounted(): boolean;
};

declare const runtime: AutomationBuilderRuntime;
export default runtime;
