// import InputUserName from "../../Other/InputUserName";
import ImageUpload from "./changeImageAvatar";
// import UploadAvatar from "../../Other/UploadAvatar"; // NOT USED ???
import UsersList from "./exampleDisplayUsers";
import ChangeProfileName from "./changeProfileName";
import { CurrUserData } from "./contextCurrentUser";
import JustTest from "./justTest";

type ContextProps = {
  updateContext: (updateUserData: CurrUserData ) => void;
};

const UserProfilePage: React.FC<ContextProps> = ({ updateContext }) => {
  return (
    <div id="user-page">
      <p>USER PROFILE PAGE</p>
      <ChangeProfileName updateContext={ updateContext } />
      <ImageUpload updateContext={ updateContext }/>
      {/* <p>Change your username: </p> */}
      {/* <InputUserName /> */}
      {/* <JustTest/> */}
      {/* <UploadAvatar /> */}  
      <UsersList />
    </div>
  );
};

export default UserProfilePage;
