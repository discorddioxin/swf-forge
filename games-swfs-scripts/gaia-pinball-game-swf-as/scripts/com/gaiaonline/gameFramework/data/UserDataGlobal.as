package com.gaiaonline.gameFramework.data
{
   import flash.text.*;
   
   public class UserDataGlobal
   {
      
      private static var allowInstantiation:Boolean;
      
      private static var instance:UserDataGlobal;
      
      public var gid:int = -1;
      
      public var sid:String = "";
      
      public var userName:String = "";
      
      private var guest:Boolean = false;
      
      public var ignoreUsers:Array = new Array();
      
      public function UserDataGlobal()
      {
         super();
         if(!allowInstantiation)
         {
            throw new Error("Error: Instantiation failed: Use UserDataGlobal.getInstance() instead of new.");
         }
      }
      
      public static function getInstance() : UserDataGlobal
      {
         if(instance == null)
         {
            trace("userDataGlobal init");
            allowInstantiation = true;
            instance = new UserDataGlobal();
            allowInstantiation = false;
         }
         return instance;
      }
      
      public function getSid() : String
      {
         return sid;
      }
      
      public function isGuest() : Boolean
      {
         return guest;
      }
      
      public function isIgnored(param1:String) : Boolean
      {
         return ignoreUsers.indexOf(param1) != -1;
      }
      
      public function setAsGuest() : void
      {
         dTrace("setAsGuest");
         guest = true;
         userName = "";
      }
      
      public function ignoreUser(param1:String) : void
      {
         ignoreUsers.push(param1);
      }
      
      public function init(param1:Object) : void
      {
         userName = param1.userName;
         if(param1.sid != null)
         {
            sid = param1.sid;
         }
         gid = param1.gid;
      }
      
      private function dTrace(param1:String) : void
      {
         trace("[UserDataGlobal]" + param1);
      }
      
      public function setSid(param1:String) : void
      {
         dTrace("setSid:" + param1);
         sid = param1;
      }
      
      public function setGaiaId(param1:uint) : void
      {
         gid = param1;
      }
      
      public function setUserName(param1:String) : void
      {
         userName = param1;
      }
   }
}

