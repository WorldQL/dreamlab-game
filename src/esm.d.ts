/* eslint-disable import/no-extraneous-dependencies */
// define types for HTTP imports

declare module 'https://esm.sh/v136/react@18.2.0' {
  import React from 'react'

  export = React
}

declare module 'https://esm.sh/v136/react@18.2.0/jsx-runtime' {
  export * from 'react/jsx-runtime'
}

declare module 'https://esm.sh/v136/styled-components@6.1.6' {
  export { default } from 'styled-components'
  export * from 'styled-components'
}
