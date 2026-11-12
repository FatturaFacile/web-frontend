import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const VISIBILITY = ['internal', 'public'] as const;

const CATEGORY_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  rf.lookup('parent_id', 'kbCategories'),
  rf.select('visibility', VISIBILITY),
  rf.integer('position', { min: 0 }),
];

const ARTICLE_FIELDS = [
  req(rf.text('title', { maxLength: 200 })),
  rf.textarea('summary', { maxLength: 2000 }),
  req(rf.textarea('content', { maxLength: 200000 })),
  rf.lookup('knowledge_category_id', 'kbCategories'),
  rf.select('visibility', VISIBILITY),
  rf.bool('is_published'),
  rf.tags('tags'),
  rf.text('change_note', { maxLength: 500 }),
];

/** Knowledge base: categories, articles with their version history. */
export const KNOWLEDGE_BASE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.KNOWLEDGE_BASE',
  tabs: [
    {
      id: 'articles',
      titleKey: 'RES.P.kb_articles',
      module: 'service',
      list: {
        path: '/esm/kb/articles',
        filters: [rf.text('q'), rf.select('visibility', VISIBILITY)],
        columns: [
          ...cols('article_number', 'title'),
          tagCol('visibility'),
          col('is_published', 'bool'),
          ...cols('current_version', 'views_count'),
        ],
      },
      detailPath: '/esm/kb/articles/{id}',
      create: act('POST', 'RES.A.new_article', '/esm/kb/articles', { fields: ARTICLE_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/kb/articles/{id}', { prefill: true, fields: ARTICLE_FIELDS }),
        act('GET', 'RES.A.article_versions', '/esm/kb/articles/{id}/versions', { showResult: true }),
        act('POST', 'RES.A.restore_version', '/esm/kb/articles/{id}/versions/{version}/restore', {
          fields: [req(rf.integer('version', { min: 1 }))],
          showResult: true,
        }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/kb/articles/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'categories',
      titleKey: 'RES.P.kb_categories',
      module: 'service',
      list: { path: '/esm/kb/categories', columns: [...cols('name'), tagCol('visibility'), ...cols('position')] },
      create: act('POST', 'RES.A.new_category', '/esm/kb/categories', { fields: CATEGORY_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/kb/categories/{id}', { prefill: true, fields: CATEGORY_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/kb/categories/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};
