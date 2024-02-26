/* eslint-disable import/no-extraneous-dependencies */
// define types for HTTP imports

declare module 'https://esm.sh/react@18.2.0' {
  import React from 'react'

  export = React
}

declare module 'https://esm.sh/react@18.2.0/jsx-runtime' {
  export * from 'react/jsx-runtime'
}

declare module 'https://esm.sh/styled-components@6.1.8?pin=v135' {
  export { default } from 'styled-components'
  export * from 'styled-components'
}

declare module 'https://esm.sh/usehooks-ts@2.12.1?pin=v135' {
  export { default } from 'usehooks-ts'
  export * from 'usehooks-ts'
}
