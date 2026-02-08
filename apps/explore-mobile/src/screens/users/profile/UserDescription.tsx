import { useSession } from '@/hooks/use-session'
import { cap } from '@/shared/lib/cap'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiUserProfile } from '@model'
import {
  AvatarLink,
  Colors,
  Flex,
  getBackButtonTemplate,
  getOptionButtonTemplate,
  IconContainer,
  IconType,
  ModalImgCarousel,
  ScreenReductor,
  Spacing,
  Text,
  TextLink,
  Title,
} from '@ui'
import * as ExpoLinking from 'expo-linking'
import React, { useState } from 'react'

const Metric = ({ metric, subtitle }: { metric: number; subtitle: string }) => (
  <Flex center={true} gap="S">
    <Title size="h2" color={Colors.label} center>
      {metric}
      {'\n'}
      <Title size="h3" color={Colors.label}>
        {subtitle}
      </Title>
    </Title>
  </Flex>
)

const ReseauLink = ({
  link,
  iconName,
}: {
  link: string
  iconName: IconType
}) => (
  <TextLink onPress={() => ExpoLinking.openURL(link)}>
    <IconContainer name={iconName} size="L" color={Colors.link} />
  </TextLink>
)

export const UserDescription = ({ user }: { user: ApiUserProfile }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const { session } = useSession()
  const { router } = useDependencies()
  const options =
    user.id === session?.user?.id
      ? {
          customStyle: {
            marginRight: -Spacing.padding.screen,
          },
          onOptionsButton: () => router.push('/settings'),
          iconName: 'threeDot' as IconType,
        }
      : undefined

  return (
    <>
      <Flex center={true}>
        {getBackButtonTemplate({
          label: '',
          onBackButton: () => router.push('/home'),
          customStyle: {
            marginLeft: -(Spacing.padding.screen * 2),
          },
        })}
        {options && getOptionButtonTemplate(options)}

        <Flex gap="XL" center={true}>
          <ScreenReductor>
            <Flex gap="XL" center={true}>
              <AvatarLink
                onPress={() => setModalOpen(true)}
                text={user.lastName[0]?.toUpperCase()}
                size="XL"
                url={user.profileImageUrl}
              />
              <Title size="h2">{user.lastName}</Title>
              <Flex direction="row">
                <Metric
                  metric={user.metrics.placesAdded}
                  subtitle="Lieux ajoutés"
                />
                <Metric
                  metric={user.metrics.placesExplored}
                  subtitle="Lieux arpentés"
                />
              </Flex>
              <Flex direction="row">
                {!!user.instagramId && (
                  <ReseauLink
                    link={`https://www.instagram.com/${user.instagramId}`}
                    iconName="instagram"
                  />
                )}
                {!!user.websiteUrl && (
                  <ReseauLink
                    link={
                      user.websiteUrl.startsWith('http')
                        ? user.websiteUrl
                        : `https://${user.websiteUrl}`
                    }
                    iconName="link"
                  />
                )}
              </Flex>
            </Flex>
          </ScreenReductor>
          <Text align="center">
            {user.biography.length > 0
              ? cap(user.biography, 255)
              : 'Cet utilisateur aime garder un air de mystère à son propos...'}
          </Text>
        </Flex>
      </Flex>
      <ModalImgCarousel
        imgUrl={modalOpen ? (user.profileImageUrl ?? '') : ''}
        setImgUrl={() => setModalOpen(false)}
      />
    </>
  )
}
