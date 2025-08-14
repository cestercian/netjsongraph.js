import NetJSONGraphDefaultConfig from "./netjsongraph.config";
import NetJSONGraphUpdate from "./netjsongraph.update";

class Selection {
  constructor() {
    this.selected = new Set();
  }

  getSetId(item) {
    if (!item) return undefined;
    if (item.node) {
      return item.node.id;
    }
    if (item.link) {
      return `${item.link.source}=>${item.link.target}`;
    }
    if (item.id) {
      return item.id;
    }
    if (item.source !== undefined && item.target !== undefined) {
      return `${item.source}=>${item.target}`;
    }
    return undefined;
  }

  isSelected(item) {
    const id = this.getSetId(item);
    return id !== undefined && this.selected.has(id);
  }

  toggleSelection(item) {
    const id = this.getSetId(item);
    if (id === undefined) return false;
    if (this.selected.has(id)) {
      this.selected.delete(id);
      return false;
    }
    this.selected.add(id);
    return true;
  }

  clear() {
    this.selected.clear();
  }

  changeSelection(echarts, params) {
    if (!params) return;
    const zrEvt = params.event || {};
    const nativeEvt = zrEvt.event || zrEvt;
    const multiSelectKey = !!(nativeEvt && (nativeEvt.ctrlKey || nativeEvt.metaKey));

    const option = echarts.getOption ? echarts.getOption() : {};
    const isGraph = params.componentSubType === "graph";

    const highlightOne = () => {
      if (isGraph) {
        echarts.dispatchAction({
          type: "highlight",
          seriesIndex: 0,
          dataType: params.dataType,
          dataIndex: params.dataIndex,
        });
      } else {
        const seriesIndex = params.componentSubType === "lines" ? 1 : 0;
        echarts.dispatchAction({
          type: "highlight",
          seriesIndex,
          dataIndex: params.dataIndex,
        });
      }
    };

    const downplayOne = () => {
      if (isGraph) {
        echarts.dispatchAction({
          type: "downplay",
          seriesIndex: 0,
          dataType: params.dataType,
          dataIndex: params.dataIndex,
        });
      } else {
        const seriesIndex = params.componentSubType === "lines" ? 1 : 0;
        echarts.dispatchAction({
          type: "downplay",
          seriesIndex,
          dataIndex: params.dataIndex,
        });
      }
    };

    const downplayAll = () => {
      if (isGraph) {
        echarts.dispatchAction({type: "downplay", seriesIndex: 0, dataType: "node"});
        echarts.dispatchAction({type: "downplay", seriesIndex: 0, dataType: "edge"});
      } else {
        echarts.dispatchAction({type: "downplay", seriesIndex: 0}); // nodes
        echarts.dispatchAction({type: "downplay", seriesIndex: 1}); // links
      }
    };

    if (multiSelectKey) {
      const turnedOn = this.toggleSelection(params.data || {});
      if (turnedOn) highlightOne();
      else downplayOne();
      return;
    }

    // Single-select behavior: clear and select the clicked item
    if (this.selected.size > 0) {
      downplayAll();
      this.clear();
    }
    this.toggleSelection(params.data || {});
    highlightOne();
  }

  // Re-apply highlights after re-render or mode switch
  highlightSelected(echarts) {
    const option = echarts.getOption ? echarts.getOption() : {};
    const series = option.series || [];
    if (!series.length) return;

    const isGraph = !!(series[0] && (series[0].type === "graph" || series[0].type === "graphGL"));
    if (isGraph) {
      const nodes = series[0].nodes || [];
      const links = series[0].links || [];
      const nodeIndexes = nodes
        .map((item, idx) => (this.isSelected(item) ? idx : -1))
        .filter((i) => i >= 0);
      const linkIndexes = links
        .map((item, idx) => (this.isSelected(item) ? idx : -1))
        .filter((i) => i >= 0);
      if (nodeIndexes.length)
        echarts.dispatchAction({type: "highlight", seriesIndex: 0, dataType: "node", dataIndex: nodeIndexes});
      if (linkIndexes.length)
        echarts.dispatchAction({type: "highlight", seriesIndex: 0, dataType: "edge", dataIndex: linkIndexes});
      return;
    }

    // Map mode: series[0] nodes scatter, series[1] lines
    const nodeSeries = series[0] || {};
    const edgeSeries = series[1] || {};
    const nodes = (nodeSeries.data || []).map((d) => (d && d.node ? d : null));
    const links = (edgeSeries.data || []).map((d) => (d && d.link ? d : null));
    const nodeIndexes = nodes
      .map((item, idx) => (item && this.isSelected(item) ? idx : -1))
      .filter((i) => i >= 0);
    const linkIndexes = links
      .map((item, idx) => (item && this.isSelected(item) ? idx : -1))
      .filter((i) => i >= 0);
    if (nodeIndexes.length)
      echarts.dispatchAction({type: "highlight", seriesIndex: 0, dataIndex: nodeIndexes});
    if (linkIndexes.length)
      echarts.dispatchAction({type: "highlight", seriesIndex: 1, dataIndex: linkIndexes});
  }
}

class NetJSONGraph {
  /**
   * @constructor
   *
   * @param {string} JSONParam    The NetJSON file param
   * @param {Object} config
   */
  constructor(JSONParam) {
    this.utils = new NetJSONGraphUpdate();
    this.selection = new Selection();
    this.config = {...NetJSONGraphDefaultConfig};
    this.JSONParam = this.utils.isArray(JSONParam) ? JSONParam : [JSONParam];
  }

  /**
   * @function
   * @name setConfig
   *
   * @param  {Object}     config
   *
   * @this   {object}     The instantiated object of NetJSONGraph
   *
   * @return {object}     this.config
   */
  setConfig(config) {
    this.utils.deepMergeObj(this.config, config);
    if (!this.el) {
      if (!this.config.el) {
        this.el = document.body;
      } else if (this.utils.isElement(this.config.el)) {
        this.el = this.config.el;
      } else {
        this.el = document.querySelector(this.config.el);
      }
      if (this.el) {
        this.el.classList.add("njg-container");
        if (this.el === document.body) {
          const htmlEl = document.documentElement;
          htmlEl.style.width = "100%";
          htmlEl.style.height = "100%";

          this.el.classList.add("njg-relativePosition");
        }
      } else {
        console.error(
          "NetJSONGraph: The specified element for rendering was not found and could not be set.",
        );
      }
    } else if (config && config.el) {
      console.error("Can't change el again!");
    }

    return this.config;
  }

  /**
   * @function
   * @name render
   * netjsongraph.js render function
   *
   * @this {object}      The instantiated object of NetJSONGraph
   */
  render() {
    const [JSONParam, ...resParam] = this.JSONParam;

    this.config.onRender.call(this);
    this.event.once("onReady", this.config.onReady.bind(this));
    this.event.once("onLoad", this.config.onLoad.bind(this));
    this.utils.paginatedDataParse
      .call(this, JSONParam)
      .then((JSONData) => {
        if (this.utils.isNetJSON(JSONData)) {
          this.type = "netjson";
        } else if (this.utils.isGeoJSON(JSONData)) {
          // Treat GeoJSON as a first-class citizen by converting it once
          // to NetJSON shape while keeping the original for polygon rendering.
          this.type = "geojson";
          // Preserve the original GeoJSON so that non-point geometries (e.g. Polygons)
          // can still be rendered as filled shapes via a separate Leaflet layer later
          // in the rendering pipeline, while the converted NetJSON shape is used for
          // clustering and ECharts overlays.
          this.originalGeoJSON = JSON.parse(JSON.stringify(JSONData));
          JSONData = this.utils.geojsonToNetjson(JSONData);
        } else {
          throw new Error("Invalid data format!");
        }

        if (this.utils.isNetJSON(JSONData)) {
          if (JSONData.nodes.length > this.config.maxPointsFetched) {
            this.hasMoreData = true;
          }
          JSONData.nodes.splice(
            this.config.maxPointsFetched - 1,
            JSONData.nodes.length - this.config.maxPointsFetched,
          );
          const nodeSet = new Set(JSONData.nodes.map((node) => node.id));
          JSONData.links = JSONData.links.filter((link) => {
            if (nodeSet.has(link.source) && nodeSet.has(link.target)) {
              return true;
            }
            if (!nodeSet.has(link.source)) {
              console.warn(`Node ${link.source} does not exist!`);
            } else {
              console.warn(`Node ${link.target} does not exist!`);
            }
            return false;
          });
        }
        this.config.prepareData.call(this, JSONData);
        this.data = JSONData;

        if (this.config.dealDataByWorker) {
          this.utils.dealDataByWorker.call(
            this,
            JSONData,
            this.config.dealDataByWorker,
          );
        } else {
          this.data = JSONData;
          this.utils.render();
        }
      })
      .catch((error) => {
        console.error(error);
      });

    if (resParam.length) {
      const renderArray = function _renderArray() {
        resParam.map((file) =>
          this.utils.JSONDataUpdate.call(this, file, false),
        );
      };
      this.JSONParam = [JSONParam];
      this.event.once("renderArray", renderArray.bind(this));
    }
  }

  /**
   * @function
   * @name setUtils
   * set netjsongraph utils
   *
   * @param {object}  util  The object of functions
   *
   * @this {object}         The instantiated object of NetJSONGraph
   */
  setUtils(util = {}) {
    const self = this;

    self.utils = Object.assign(
      self.utils,
      {...util},
      {
        /**
         * @function
         * @name render
         * Perform different renderings according to `render` config.
         */

        render() {
          if (self.config.render) {
            self.config.render(self.data, self);
          } else {
            throw new Error("No render function!");
          }
        },
      },
    );

    return self.utils;
  }
}

export default NetJSONGraph;
