/**
 * ③ 字段备注 · 紧凑列表（多字段合并为一张规格表，减少弹窗留白）
 */
(function () {
  const DemoFieldRemarkList = {
    name: 'DemoFieldRemarkList',
    props: {
      title: { type: String, default: '③ 字段取值规格' },
      items: { type: Array, default: () => [] },
    },
    template: `
      <div v-if="visibleItems.length" class="demo-field-remark-list">
        <div v-if="title" class="demo-field-remark-list__title">{{ title }}</div>
        <table class="demo-field-remark-list__table">
          <tbody>
            <tr v-for="item in visibleItems" :key="item.key">
              <th class="demo-field-remark-list__label" scope="row">{{ item.label }}</th>
              <td class="demo-field-remark-list__spec">
                <ol class="demo-field-remark-list__points">
                  <li v-for="(line, idx) in item.points" :key="idx">{{ line }}</li>
                </ol>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    setup(props) {
      const visibleItems = Vue.computed(() => (
        (props.items || []).filter((item) => item.points?.length)
      ));
      return { visibleItems };
    },
  };

  window.ChromDriftFieldRemarkList = DemoFieldRemarkList;
})();
