/* eslint-disable import/no-extraneous-dependencies */
// define types for HTTP imports

declare module 'https://esm.sh/v135/react@18.2.0' {
  import React from 'react'

  export = React
}

declare module 'https://esm.sh/v135/react@18.2.0/jsx-runtime' {
  export * from 'react/jsx-runtime'
}

declare module 'https://esm.sh/v135/styled-components@6.1.8' {
  export { default } from 'styled-components'
  export * from 'styled-components'
}

declare module 'https://esm.sh/v135/usehooks-ts@2.12.1' {
  export { default } from 'usehooks-ts'
  export * from 'usehooks-ts'
}
