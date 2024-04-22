import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const CollapsibleContainer = styled.div`
  margin: 0;
`

const CollapsibleHeader = styled.button`
  background: #140110;
  color: white;
  border: none;
  text-align: left;
  outline: none;
  padding: 5px;
  width: 100%;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-bottom: 5px;
  border-radius: 5px;

  &:hover {
    background-color: #0056b3;
  }
`

const CollapsibleContent = styled.div<{ isOpen: boolean }>`
  padding: 5px;
  display: ${({ isOpen }) => (isOpen ? 'block' : 'none')};
  overflow: hidden;
  transition: max-height 0.2s ease-out;
`

interface CollapsibleSectionProps {
  readonly title: string
  readonly children: ReactNode
  readonly forceOpen: boolean
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, forceOpen }) => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(forceOpen)
    }
  }, [forceOpen])

  const toggle = () => {
    setIsOpen(!isOpen)
  }

  return (
    <CollapsibleContainer>
      <CollapsibleHeader onClick={toggle}>{title}</CollapsibleHeader>
      <CollapsibleContent isOpen={isOpen}>{children}</CollapsibleContent>
    </CollapsibleContainer>
  )
}

export default CollapsibleSection
