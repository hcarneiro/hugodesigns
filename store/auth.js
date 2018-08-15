import Cookies from 'js-cookie'
import moment from 'moment'

const COOKIE_EXPIRE_DAYS = 30
const ADMIN_ROLE_ID = 1

export const state = () => ({
  currentUser: {},
  verified: false,
  authenticated: false,
  auth_token: '',
  ui: {}
})

export const mutations = {
  setUser(state, user) {
    state.currentUser = user
    state.ui.isAdmin = user && user.userRoleId === ADMIN_ROLE_ID
  },
  setVerified(state, status) {
    state.verified = status
  },
  setAuthenticated(state, status) {
    state.authenticated = status
  },
  setAuthToken(state, token) {
    state.auth_token = token
  }
}

export const actions = {
  login({commit, dispatch}, credentials) {
    credentials = credentials || {}

    return this.$axios.post(`/v1/auth/login`, credentials)
      .then((res) => {
        return res
      })
      .then((response) => {
        dispatch('onLogin', response.data.auth_token, credentials)
        return response.data
      })
  },
  logout({commit}) {
    return this.$axios.post(`/v1/auth/logout`)
      .then(() => {
        commit('setUser', undefined)
        Cookies.remove('_auth_token')
        commit('setAuthenticated', false)
        commit('setAuthToken', '')

        return Promise.resolve()
      })
  },
  onLogin({commit}, authToken, options) {
    if (!authToken) {
      throw new Error('Cannot login with no authToken')
    }

    commit('setVerified', true)
    commit('setAuthenticated', true)
    commit('setAuthToken', authToken)

    const remember = options ? options.remember : Cookies.get('_remember')

    if (Cookies.get('_remember') || remember) {
      Cookies.set('_remember', remember ? 'true' : '', {
        expires: remember ? COOKIE_EXPIRE_DAYS : undefined
      })
    }

    Cookies.set('_auth_token', authToken, {
      expires: Cookies.get('_remember') ? COOKIE_EXPIRE_DAYS : undefined
    })
  },
  verifyUser({state, commit, dispatch}, forceCheck, setCookie) {
    if (!state.authenticated) {
      commit('setAuthToken', Cookies.get('_auth_token'))
      commit('setAuthenticated', !!state.auth_token)
    }

    if (!state.authenticated && forceCheck) {
      return Promise.reject('You are not signed in. Please sign in.')
    }

    const params = { _: moment().unix() }

    if (setCookie) {
      params.auth_token = state.auth_token
      params.setCookie = true
    }

    return this.$axios.get(`v1/users`, { params }).then((response) => {
      return response
    })
    .then((response) => {
      const user = response.data.user
      const session = response.data.session

      commit('setUser', user)
      dispatch('onLogin', session && session.auth_token || user.auth_token)
      return Promise.resolve()
    })
    .catch((err) => {
      if (!forceCheck) {
        dispatch('logout')
      }
      return Promise.reject(err)
    })
  },
  verify({state, dispatch}) {
    if (state.verified) {
      return Promise.resolve()
    }

    return dispatch('verifyUser')
  },
  verifyUserEmail({dispatch}, token) {
    return this.$axios.post(`/v1/auth/verify/${token}`)
      .then((response) => {
        // Token is stored to log the user in
        dispatch('onLogin', response.data.auth_token)
        return Promise.resolve()
      })
  },
  forgotPassword({}, email) {
    return this.$axios.post('v1/auth/forgot', { email })
  },
  resetPassword({}, params) {
    const password = params.password || ''
    const token = params.token || ''

    return this.$axios.post(`v1/auth/reset/${token}`, { password })
  },
  getResetTokenInfo({}, token) {
    return this.$axios.get(`v1/auth/reset/${token}`)
  },
  signUp({}, data) {
    return this.$axios.post('v1/auth/signup', data).then((response) => {
      return Promise.resolve(response.data)
    })
  }
}