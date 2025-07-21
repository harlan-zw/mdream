export default defineAppConfig({
  toaster: {
    position: 'bottom-right' as const,
    expand: true,
    duration: 5000,
  },
  ui: {
    tabs: { trigger: 'leading-8', label: 'font-medium', list: 'h-[48px] gap-5 p-0 ', variants: { size: { md: { trigger: 'px-0 pt-0' } } } },
    navigationMenu: {
      slots: {
        list: 'gap-1.5',
      },
      variants: {
        active: {
          false: {
            link: 'text-[var(--ui-text-toned)]',
            linkLeadingIcon: 'text-[var(--ui-text-toned)]',
          },
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'pill',
          active: true,
          class: {
            link: 'text-[var(--ui-text)]',
            linkLeadingIcon: 'rounded-full p-[1px] text-[var(--ui-text)] group-data-[state=open]:text-[var(--ui-primary)]',
          },
        },
        {
          orientation: 'horizontal',
          highlight: true,
          class: {
            item: '-mb-px',
            link: [
              'after:absolute after:bottom-0 after:-inset-x-1 after:block after:h-full after:rounded-[var(--ui-radius)]',
              'after:transition-colors',
              'after:opacity-20',
            ],
          },
        },
      ],
    },
    icons: {
      caution: 'i-carbon-warning-alt',
      copy: 'i-carbon-copy',
      dark: 'i-carbon-moon',
      document: 'i-carbon-document',
      external: 'i-carbon-launch',
      hash: 'i-carbon-hashtag',
      light: 'i-carbon-sun',
      menu: 'i-carbon-menu',
      next: 'i-carbon-arrow-right',
      note: 'i-carbon-information',
      prev: 'i-carbon-arrow-left',
      system: 'i-carbon-computer',
      tip: 'i-carbon-lightbulb',
      warning: 'i-carbon-warning',
      chevronDoubleLeft: 'i-carbon-chevron-double-left',
      chevronDoubleRight: 'i-carbon-chevron-double-right',
      chevronDown: 'i-carbon-chevron-down',
      chevronLeft: 'i-carbon-chevron-left',
      chevronRight: 'i-carbon-chevron-right',
      arrowLeft: 'i-carbon-arrow-left',
      arrowRight: 'i-carbon-arrow-right',
      check: 'i-carbon-checkmark',
      close: 'i-carbon-close',
      ellipsis: 'i-carbon-overflow-menu-horizontal',
      loading: 'i-carbon-loading',
      minus: 'i-carbon-subtract',
      search: 'i-carbon-search',
    },
    colors: {
      primary: 'amber',
      neutral: 'stone',
    },
  },
  uiPro: {
    contentNavigation: {
      slots: {
        list: 'space-y-2',
        listWithChildren: 'border-none transform mb-5',
      },
      variants: {
        active: {
          true: {
            link: 'text-[var(--ui-text-toned)] after:-left-[1px] font-semibold rounded-[10px] after:rounded-[10px] after:w-full after:h-full after:absolute after:bottom-0 after:block after:bg-[var(--ui-bg-elevated)]/50 after:shadow-xs',
          },
          false: {
            link: 'text-[var(--ui-text-toned)]',
            linkLeadingIcon: 'text-[var(--ui-text-dimmed)]',
          },
        },
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'pill',
          active: true,
          class: {
            link: 'text-[var(--ui-text-highlighted)] ',
          },
        },
      ],
    },
    prose: {
      codeIcon: {
        'robots.txt': 'vscode-icons:file-type-robots',
      },
      a: {
        base: [
          'relative border-none underline underline-offset-6 text-[var(--ui-text)] decoration-transition-all decoration-[0.1rem] decoration-[var(--ui-text-secondary)]',
          // set a :after border under the link
          'transition-all',
          'hover:text-[var(--ui-text-secondary)] hover:underline-offset-4 hover:decoration-[0.25rem]',
        ],
      },
    },
  },
})
