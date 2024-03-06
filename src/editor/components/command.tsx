import { base58 } from '@scure/base'
import copy from 'copy-to-clipboard'
import {
  useCallback,
  useMemo,
  useState,
} from 'https://esm.sh/v135/react@18.2.0'
import type { FC } from 'https://esm.sh/v135/react@18.2.0'
import { styled } from 'https://esm.sh/v135/styled-components@6.1.8'
import type { EditDetails } from '../editor'
import { Card } from './ui/card'

const Container = styled.div`
  --margin: 1rem;

  position: fixed;
  top: 0.5rem;
  right: 5rem;

  margin: var(--margin);
  display: flex;
`

const Text = styled.span`
  padding: 1rem;
  font-family: 'Fira Code', monospace;
`

const Copy = styled.div`
  width: 1.5rem;
  height: auto;
  margin-right: 1rem;
  border-radius: 5px;
  cursor: pointer;

  background-color: rgb(30 30 30 / 0);
  transition: background-color 0.1s ease;

  &:hover {
    background-color: rgb(30 30 30 / 0.2);
  }
`

interface Props {
  readonly details: EditDetails
}

const encodeBlob = (baseUrl: string, editToken: string) => {
  const encodedBaseUrl = new TextEncoder().encode(baseUrl)
  const encodedEditToken = new TextEncoder().encode(editToken)

  const array = new Uint8Array(
    4 + encodedBaseUrl.length + encodedEditToken.length,
  )
  const view = new DataView(array.buffer, array.byteOffset, array.byteLength)
  view.setInt16(0, encodedBaseUrl.byteLength)
  array.set(encodedBaseUrl, 2)
  view.setInt16(2 + encodedBaseUrl.byteLength, encodedEditToken.byteLength)
  array.set(encodedEditToken, 4 + encodedBaseUrl.byteLength)

  return base58.encode(array)
}

export const CLICommand: FC<Props> = ({ details }) => {
  const command = useMemo<string>(() => {
    const baseUrl = new URL(details.server)
    baseUrl.protocol = baseUrl.protocol === 'wss:' ? 'https' : 'http'
    baseUrl.pathname = `/api/v1/edit/${details.instance}`
    const blob = encodeBlob(baseUrl.toString(), details.secret)
    return `npx dreamlab-cli@latest dev ${blob}`
  }, [details])

  const [copied, setCopied] = useState<boolean>(false)

  const onClick = useCallback(() => {
    copy(command)
    setCopied(true)

    setTimeout(() => setCopied(false), 2_000)
  }, [command, setCopied])

  return (
    <Container>
      <Card>
        <Text>
          {copied
            ? 'Command copied! Paste it in your terminal.'
            : 'Attach VS Code (copy command)'}
        </Text>
        <Copy onClick={onClick}>
          <svg
            className='w-6 h-6'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            viewBox='0 0 24 24'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </Copy>
      </Card>
    </Container>
  )
}
