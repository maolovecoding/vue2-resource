/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 已经安装过的插件做缓存
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters 获取除了插件函数以为的其他参数
    const args = toArray(arguments, 1)
    args.unshift(this) // this === Vue
    // 插件是对象 有install函数
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 插件本身直接是一个函数
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
