package
{
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1321")]
   public dynamic class PinballArtBumper extends Bumper
   {
      
      public function PinballArtBumper()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         bumperInit(null);
         stop();
      }
   }
}

