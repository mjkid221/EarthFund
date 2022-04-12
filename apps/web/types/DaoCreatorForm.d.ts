interface DaoCreationForm {
  childDaoTokenName: string;
  childDaoTokenSymbol: string;
  childDaoSubDomain: string;
  gnosisOwners: { address: string }[];
  gnosisThreshold: number;
}
