export const isDebug = () => {
  const params = new URLSearchParams(window.location.search)
  const param = params.get('debug')

  return import.meta.env.DEV ? param !== 'false' : param === 'true'
}
