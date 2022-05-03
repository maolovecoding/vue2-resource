/* @flow */

import { remove, isDef } from 'shared/util'

export default {
  // ref初始化的时候 会调用该方法
  create (_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    registerRef(vnode, true)
  }
}

export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  // ref最开始都是在data上的 取出ref
  const key = vnode.data.ref
  if (!isDef(key)) return
  // 拿到实例
  const vm = vnode.context
  // 组件 -> 取出组件实例  是元素 -> 取出真实dom
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs // 默认是一个空对象
  if (isRemoval) {
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  } else {
    // ref="my" v-for 使用了ref和v-for ref维护为一个数组
    if (vnode.data.refInFor) {
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        refs[key].push(ref)
      }
    } else {
      // 没有v-for 直接赋值
      refs[key] = ref
    }
  }
}
