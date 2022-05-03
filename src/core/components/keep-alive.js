/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      const name: ?string = entry.name
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  // 抽象组件 不会被记录到 $children 和 $parent上
  abstract: true,

  props: {// 属性
    // 可以缓存那些组件
    include: patternTypes,
    // 可以排除那些组件
    exclude: patternTypes,
    // 最大缓存个数
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          // 缓存中 放置需要缓存的组件 存放组件的实例
          name: getComponentName(componentOptions),
          tag,
          componentInstance, // 组件实例渲染后 会有 $el属性 下次直接复用 $el
        }
        keys.push(keyToCache) // 放入key
        // prune oldest entry
        // 超过最大长度 会移除最长时间未使用的缓存
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    // 创建一个缓存区 {}
    this.cache = Object.create(null)
    // 缓存组件的名字有哪些 []
    this.keys = []
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    // 渲染完成后 缓存vnode
    this.cacheVNode()
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    // 取出默认插槽
    const slot = this.$slots.default
    // 获取插槽中的第一个vnode
    const vnode: VNode = getFirstComponentChild(slot)
    // 拿到第一个插槽上的组件的额外选项 {Ctor, propsData, listeners, tag, children }
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern 获取组件的名字 看组件是否加载过
      const name: ?string = getComponentName(componentOptions)
      // 校验是否需要缓存
      const { include, exclude } = this
      if ( // 这些情况不需要复用
        // not included 不需要缓存
        (include && (!name || !matches(include, name))) ||
        // excluded 排除的
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }
      // 缓存对象 {} []
      const { cache, keys } = this
      // 生成一个唯一的 key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) { // key缓存过
        // 获取缓存的实例
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key) // 把当前的key作为最新的
        keys.push(key)
      } else {
        // delay setting the cache until update
        // 以前没有缓存过 将当前的vnode进行缓存 缓存key
        this.vnodeToCache = vnode
        this.keyToCache = key
      }
      // 给虚拟节点增加标识 data: keepAlive:true
      vnode.data.keepAlive = true
    }
    // vnode上有 data.keepAlive 和 componentInstance 说明vnode缓存过
    return vnode || (slot && slot[0]) // 返回vnode
  }
}
