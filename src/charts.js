import { planNames } from "./session-report.js";
import { money, token } from "./utils.js";
export const planColors = ["#5869d9", "#d99b61"];
const sourceColors = ["#71819b", "#b795ce", "#81a8bb", "#6977ca", "#b4b9c9", "#c7ab70", "#83b5ad", "#5d9a8b", "#b8ba7c", "#8e81c0", "#ca9eac", "#dcad84", "#5467b7", "#9ba7b6", "#8e65c3"];
export function trendOption(results, metric, currency) {
  const format = ["cost", "cumulativeCost"].includes(metric) ? value => money(value, currency) : token;
  return {
    color: planColors,
    animation: false,
    grid: { left: 16, right: 24, top: 48, bottom: 16, containLabel: true },
    legend: { right: 10, top: 4, icon: "roundRect", itemWidth: 16, itemHeight: 5, textStyle: { color: "#798296", fontSize: 11 } },
    tooltip: { trigger: "axis", valueFormatter: format },
    xAxis: { type: "value", min: results[0].rounds.length === 1 ? 0.5 : 1, max: results[0].rounds.length === 1 ? 1.5 : results[0].rounds.length, minInterval: 1, axisLabel: { color: "#9299aa", formatter: value => Number.isInteger(value) ? "第 " + value + " 轮" : "" }, axisLine: { lineStyle: { color: "#e3e7ef" } }, splitLine: { show: false } },
    yAxis: { type: "value", axisLabel: { color: "#9299aa", formatter: format }, splitLine: { lineStyle: { color: "#eef0f5", type: "dashed" } } },
    series: results.map((result, planIndex) => {
      const step = Math.max(1, Math.ceil(result.rounds.length / 250));
      const keep = new Set([0, result.rounds.length - 1]);
      let peak = 0;
      result.rounds.forEach((r, i) => {
        if (r[metric] > result.rounds[peak][metric]) peak = i;
        if (r.compression) [i - 1, i, i + 1].forEach(n => keep.add(n));
      });
      keep.add(peak);
      const rows = result.rounds.filter((_, i) => i % step === 0 || keep.has(i));
      return {
        name: planNames[planIndex], type: "line", showSymbol: rows.length < 25, symbolSize: 5,
        lineStyle: { width: 2.5 }, emphasis: { focus: "series" },
        data: rows.flatMap(r => metric === "context" && r.compression ? [[r.round, r.beforeCompression], [r.round, r.context]] : [[r.round, r[metric]]]),
        markPoint: {
          symbol: "circle", symbolSize: 8, label: { show: false },
          tooltip: { formatter: p => "第 " + p.data.round + " 轮 · 历史压缩<br/>点击查看请求明细" },
          data: result.rounds.filter(r => r.compression).map(r => ({ coord: [r.round, r[metric]], round: r.round, planIndex })),
        },
      };
    }),
  };
}

export function sourceOption(results, currency) {
  const totals = results.map(result => result.cost.total);
  const maxTotal = Math.max(...totals);

  // 同一个来源始终使用同一个颜色
  const uniqueSources = results
    .flatMap(result => result.sources)
    .filter(
      (source, index, array) =>
        array.findIndex(item => item.key === source.key) === index
    );

  const sourceColorMap = new Map(
    uniqueSources.map((source, index) => [
      source.key,
      sourceColors[index % sourceColors.length],
    ])
  );

  const series = results.map((result, index) => {
    const difference = maxTotal - result.cost.total;

    const data = result.sources
      .filter(source => source.cost.total > 0)
      .map(source => ({
        name: source.name,
        value: source.cost.total,

        itemStyle: {
          color: sourceColorMap.get(source.key),

          // 小切片之间留一点空气感
          borderColor: "#fff",
          borderWidth: 2,
          borderRadius: 3,
        },

        label: {
          show: false,
        },

        labelLine: {
          show: false,
        },
      }));

    if (difference > 0) {
      data.push({
        name: "差额",
        value: difference,
        isDifference: true,

        // 真正透明，形成缺口
        itemStyle: {
          color: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
        },

        // 只在缺口中显示百分比
        label: {
          show: true,
          position: "inside",
          formatter: "{d}%",
          color: "#8b94a7",
          fontSize: 12,
          fontWeight: 500,
        },

        labelLine: {
          show: false,
        },

        emphasis: {
          scale: false,

          itemStyle: {
            color: "transparent",
            borderColor: "transparent",
          },

          label: {
            show: true,
            color: "#697386",
          },
        },
      });
    }

    // 包括差额，统一按费用从大到小
    data.sort((a, b) => b.value - a.value);

    return {
      name: planNames[index],
      type: "pie",

      // 比当前截图稍微收一点
      radius: ["40%", "64%"],

      center: [
        index === 0 ? "27%" : "73%",
        "45%",
      ],

      startAngle: 90,
      clockwise: true,

      // ECharts 新版支持的话，小切片会更精致
      padAngle: 1,

      minShowLabelAngle: 6,

      avoidLabelOverlap: true,

      label: {
        show: false,
      },

      labelLine: {
        show: false,
      },

      emphasis: {
        scale: true,
        scaleSize: 5,

        itemStyle: {
          shadowBlur: 10,
          shadowColor: "rgba(40, 52, 80, 0.10)",
        },

        label: {
          show: false,
        },
      },

      data,
    };
  });

  return {
    animation: false,

    tooltip: {
      trigger: "item",
      confine: true,

      backgroundColor: "rgba(255, 255, 255, 0.98)",
      borderColor: "#e4e8f0",
      borderWidth: 1,

      padding: [9, 12],

      textStyle: {
        color: "#465064",
        fontSize: 12,
      },

      extraCssText:
        "box-shadow: 0 6px 20px rgba(31, 42, 68, 0.10); border-radius: 7px;",

      formatter: params => {
        const value = money(params.value, currency, true);

        return `
          <div style="
            display:flex;
            align-items:center;
            gap:8px;
            white-space:nowrap;
          ">
            ${
              params.name === "差额"
                ? ""
                : `<span style="
                    width:7px;
                    height:7px;
                    flex:none;
                    border-radius:50%;
                    background:${params.color};
                  "></span>`
            }

            <span style="color:#6f788b;">
              ${params.name}
            </span>

            <strong style="
              margin-left:8px;
              color:#30384a;
              font-weight:600;
            ">
              ${value}
            </strong>

            <span style="
              margin-left:2px;
              color:#929bad;
            ">
              ${params.percent}%
            </span>
          </div>
        `;
      },
    },

    // 饼图中间直接说明方案与费用
    title: results.map((result, index) => ({
      text: planNames[index],

      subtext:
        money(result.cost.total, currency) +
        (result.cost.total < maxTotal
          ? `\n节省 ${money(maxTotal - result.cost.total, currency)}`
          : "\n总费用"),

      left: index === 0 ? "27%" : "73%",
      top: "39.5%",

      textAlign: "center",

      textStyle: {
        color: "#4d5669",
        fontSize: 13,
        fontWeight: 500,
      },

      subtextStyle: {
        color:
          result.cost.total < maxTotal
            ? "#6575c8"
            : "#8e97a8",
        fontSize: 11,
        lineHeight: 18,
        fontWeight: 400,
      },
    })),

    legend: {
      type: "scroll",
      left: 20,
      right: 20,
      bottom: 0,

      icon: "circle",
      itemWidth: 7,
      itemHeight: 7,
      itemGap: 14,

      pageIconSize: 10,

      pageTextStyle: {
        color: "#929bad",
        fontSize: 10,
      },

      textStyle: {
        color: "#7f899c",
        fontSize: 10,
      },

      // 不在 legend 里展示“差额”
      data: uniqueSources.map(source => source.name),
    },

    series,
  };
}